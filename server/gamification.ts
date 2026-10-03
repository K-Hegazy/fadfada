import { Database as SqlDatabase } from 'sql.js';
import { queryAll, queryOne, saveDb } from './db.js';
import crypto from 'crypto';

export function addXp(db: SqlDatabase, userId: string, xpGain: number): { currentXp: number; currentLevel: number; leveledUp: boolean } {
  const user = queryOne(db, "SELECT xp, level, coins, is_guest FROM users WHERE id = ?", [userId]);
  if (!user || user.is_guest === 1) return { currentXp: 0, currentLevel: 0, leveledUp: false };

  const newXp = (user.xp || 0) + xpGain;
  // Level curve: Level 1 = 0-100, Level 2 = 101-250, Level 3 = 251-450, Level 4 = 451-700, etc.
  // Formula: level = Math.floor(Math.sqrt(newXp / 25)) + 1
  const newLevel = Math.max(1, Math.floor(Math.sqrt(newXp / 30)) + 1);
  const leveledUp = newLevel > user.level;

  let bonusCoins = 0;
  if (leveledUp) {
    bonusCoins = (newLevel - user.level) * 50;
    // Add notification
    const notifId = 'notif_' + crypto.randomUUID();
    db.run(
      "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)",
      [
        notifId,
        userId,
        'level_up',
        'ترقية إلى مستوى جديد! 🎉',
        `تهانينا! لقد بلغت المستوى ${newLevel} وحصلت على ${bonusCoins} كوينز مكافأة تميز.`,
        '/levels'
      ]
    );

    // Record wallet transaction
    if (bonusCoins > 0) {
      const txId = 'tx_' + crypto.randomUUID();
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)",
        [txId, userId, bonusCoins, 'level_up_reward', `مكافأة الوصول للمستوى ${newLevel}`]
      );
    }
  }

  db.run(
    "UPDATE users SET xp = ?, level = ?, coins = coins + ? WHERE id = ?",
    [newXp, newLevel, bonusCoins, userId]
  );
  saveDb();

  return { currentXp: newXp, currentLevel: newLevel, leveledUp };
}

export function trackMissionAction(db: SqlDatabase, userId: string, actionType: string, count: number = 1) {
  const user = queryOne(db, "SELECT is_guest FROM users WHERE id = ?", [userId]);
  if (!user || user.is_guest === 1) return;

  const todayKey = new Date().toISOString().slice(0, 10);
  const activeMissions = queryAll(
    db,
    "SELECT * FROM missions WHERE action_type = ?",
    [actionType]
  );

  for (const m of activeMissions) {
    let progress = queryOne(
      db,
      "SELECT * FROM user_mission_progress WHERE user_id = ? AND mission_id = ? AND date_key = ?",
      [userId, m.id, todayKey]
    );

    if (!progress) {
      const progId = 'prog_' + crypto.randomUUID();
      db.run(
        "INSERT INTO user_mission_progress (id, user_id, mission_id, current_count, is_completed, is_claimed, date_key) VALUES (?, ?, ?, ?, 0, 0, ?)",
        [progId, userId, m.id, count, todayKey]
      );
      progress = { id: progId, current_count: count, is_completed: 0, is_claimed: 0 };
    } else if (progress.is_completed === 0) {
      const newCount = progress.current_count + count;
      const isCompleted = newCount >= m.target_count ? 1 : 0;
      db.run(
        "UPDATE user_mission_progress SET current_count = ?, is_completed = ? WHERE id = ?",
        [newCount, isCompleted, progress.id]
      );

      if (isCompleted === 1 && progress.is_completed === 0) {
        // Send notification
        const notifId = 'notif_' + crypto.randomUUID();
        db.run(
          "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, ?, ?, ?, ?)",
          [
            notifId,
            userId,
            'mission_completed',
            'إنجاز مهمة يومية! ✨',
            `لقد أتممت بنجاح مهمة "${m.title}". افتح قسم المهام لاستلام مكافأتك.`,
            '/missions'
          ]
        );
      }
    }
  }
  saveDb();
}

export function checkDailyStreak(db: SqlDatabase, userId: string): { streak: number; awarded: boolean } {
  const user = queryOne(db, "SELECT streak, last_login_date, is_guest FROM users WHERE id = ?", [userId]);
  if (!user || user.is_guest === 1) return { streak: 0, awarded: false };

  const today = new Date().toISOString().slice(0, 10);
  if (user.last_login_date === today) {
    return { streak: user.streak || 1, awarded: false };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak = 1;
  if (user.last_login_date === yesterday) {
    newStreak = (user.streak || 0) + 1;
  }

  // Award streak XP & coins
  const xpReward = Math.min(100, newStreak * 15);
  const coinsReward = Math.min(50, newStreak * 10);

  db.run(
    "UPDATE users SET streak = ?, last_login_date = ? WHERE id = ?",
    [newStreak, today, userId]
  );
  addXp(db, userId, xpReward);

  const txId = 'tx_' + crypto.randomUUID();
  db.run(
    "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)",
    [txId, userId, coinsReward, 'daily_login', `مكافأة الحضور اليومي (شعلة يوم ${newStreak})`]
  );
  db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [coinsReward, userId]);

  trackMissionAction(db, userId, 'daily_login', 1);
  saveDb();

  return { streak: newStreak, awarded: true };
}
