import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { getDb, queryAll, queryOne, saveDb, saveDbSync } from './server/db.js';
import {
  hashPassword,
  verifyPassword,
  validate18Plus,
  createSession,
  authenticateToken,
  UserSession
} from './server/auth.js';
import {
  addXp,
  trackMissionAction,
  checkDailyStreak
} from './server/gamification.js';
import { askAssistant } from './server/assistant.js';
import {
  detectUserCountry,
  resolveArabicCountry,
  ISO_TO_ARABIC,
  ARABIC_TO_ISO
} from './server/geolocation.js';
import {
  createAndSendVerification,
  verifyTokenOrCode,
  createAndSendPasswordReset,
  verifyPasswordResetToken,
  isSmtpConfigured,
  getTransporter
} from './server/mailer.js';
import {
  loginRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
  emailVerifyRateLimiter,
  messageSendRateLimiter,
  uploadRateLimiter,
  friendRequestRateLimiter,
  storyRateLimiter,
  gameActionRateLimiter,
  reportRateLimiter,
  giftRateLimiter,
  resetPasswordRateLimiter
} from './server/rateLimiter.js';
import { checkMessageContent } from './server/moderation.js';
import { initCronJobs } from './server/cron.js';

dotenv.config();

const PORT = 3000;
const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);

// Data upload folder
const UPLOAD_DIR = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper to parse cookies safely
function parseCookies(header?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!header) return list;
  header.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return list;
}

// SECURE AUTHENTICATED MEDIA ACCESS (/uploads/:filename)
// Strictly enforces authentication, authorization, ownership, view-once destruction, and block verification
app.get('/uploads/:filename', async (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }

    const cookieToken = parseCookies(req.headers.cookie).auth_token;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ((req.query.token as string) || cookieToken);

    const db = await getDb();
    const session = token ? authenticateToken(db, token) : null;
    const fileUrl = `/uploads/${safeFilename}`;

    // 1. Public App & Profile Assets (Avatars, Covers, Room Images, Gifts)
    const isPublicUserAsset = queryOne(db, "SELECT id FROM users WHERE avatar_url = ? OR cover_url = ?", [fileUrl, fileUrl]);
    const isRoomAsset = queryOne(db, "SELECT id FROM rooms WHERE image_url = ?", [fileUrl]);
    if (isPublicUserAsset || isRoomAsset) {
      return res.sendFile(filePath);
    }

    // 2. Stories Media Authorization
    const story = queryOne(db, "SELECT id, user_id, expires_at FROM stories WHERE media_url = ?", [fileUrl]);
    if (story) {
      if (!session) {
        return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً لمشاهدة محتوى القصص' });
      }
      if (new Date(story.expires_at).getTime() <= Date.now()) {
        return res.status(410).json({ error: 'انتهت صلاحية هذه القصة' });
      }
      const isBlocked = queryOne(
        db,
        "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
        [story.user_id, session.userId, session.userId, story.user_id]
      );
      if (isBlocked) {
        return res.status(403).json({ error: 'غير مصرح بالوصول إلى وسائط هذا المستخدم' });
      }
      return res.sendFile(filePath);
    }

    // 3. Room Messages Media Authorization
    const roomMsg = queryOne(db, "SELECT id, room_id FROM room_messages WHERE media_url = ?", [fileUrl]);
    if (roomMsg) {
      if (!session) {
        return res.status(401).json({ error: 'الرجاء تسجيل الدخول لعرض وسائط الغرفة' });
      }
      const member = queryOne(db, "SELECT is_banned FROM room_members WHERE room_id = ? AND user_id = ?", [roomMsg.room_id, session.userId]);
      if (member && member.is_banned === 1) {
        return res.status(403).json({ error: 'تم حظرك من هذه الغرفة' });
      }
      return res.sendFile(filePath);
    }

    // 4. Private Messages Media Authorization
    const pmsg = queryOne(
      db,
      "SELECT id, sender_id, recipient_id, is_view_once, is_viewed, is_self_destruct, is_destroyed FROM private_messages WHERE media_url = ?",
      [fileUrl]
    );
    if (pmsg) {
      if (!session) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول لعرض وسائط المحادثة الخاصة' });
      }
      if (pmsg.sender_id !== session.userId && pmsg.recipient_id !== session.userId) {
        return res.status(403).json({ error: 'غير مصرح بالوصول إلى وسائط هذه المحادثة الخاصة' });
      }

      // Check block between participants
      const otherUserId = pmsg.sender_id === session.userId ? pmsg.recipient_id : pmsg.sender_id;
      const isBlocked = queryOne(
        db,
        "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
        [otherUserId, session.userId, session.userId, otherUserId]
      );
      if (isBlocked) {
        return res.status(403).json({ error: 'تم حظر الحساب' });
      }

      // View-Once destruction check: once recipient views, media becomes completely inaccessible
      if (pmsg.is_view_once === 1 && pmsg.recipient_id === session.userId && pmsg.is_viewed === 1) {
        return res.status(410).json({ error: 'تم فتح هذه الوسائط لمرة واحدة مسبقاً وتدميرها (View Once)' });
      }

      // Self-destruct check
      if (pmsg.is_self_destruct === 1 && pmsg.is_destroyed === 1) {
        return res.status(410).json({ error: 'تم تدمير هذه الوسائط ذاتياً' });
      }

      return res.sendFile(filePath);
    }

    // 5. Reports Evidence Authorization
    const report = queryOne(
      db,
      "SELECT id, reporter_id, reported_user_id FROM reports WHERE evidence_url = ?",
      [fileUrl]
    );
    if (report) {
      if (!session) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول لعرض المرفقات' });
      }
      const isStaff = ['owner', 'admin', 'moderator'].includes(session.role);
      const isParty = report.reporter_id === session.userId || report.reported_user_id === session.userId;
      if (!isStaff && !isParty) {
        return res.status(403).json({ error: 'غير مصرح لك بالاطلاع على مرفقات هذا البلاغ' });
      }
      return res.sendFile(filePath);
    }

    // Staff access for management, otherwise reject
    if (session && ['owner', 'admin'].includes(session.role)) {
      return res.sendFile(filePath);
    }

    return res.status(403).json({ error: 'غير مصرح بالوصول لهذا الملف' });
  } catch (err) {
    console.error('Secure media serving error:', err);
    return res.status(500).json({ error: 'خطأ في معالجة الوسائط' });
  }
});

// WebSocket setup for real-time presence, messaging, typing, and notifications
const wss = new WebSocketServer({ server });
const connectedSockets = new Map<string, Set<WebSocket>>(); // userId -> Set<WebSocket>
const socketUserMap = new Map<WebSocket, string>(); // WebSocket -> userId

export function isUserOnline(userId: string): boolean {
  const sockets = connectedSockets.get(userId);
  return !!(sockets && sockets.size > 0);
}

// Authenticate request middleware
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const cookieToken = parseCookies(req.headers.cookie).auth_token;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ((req.query.token as string) || cookieToken);

  if (!token) {
    return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
  }

  const db = await getDb();
  const session = authenticateToken(db, token);
  if (!session) {
    return res.status(401).json({ error: 'جلسة الدخول منتهية أو غير صالحة' });
  }

  (req as any).user = session;
  next();
}

// Strict server-side verification: ONLY the genuine Owner Hegazy is allowed
function verifyOwnerHegazy(db: any, session: UserSession | undefined): { ok: boolean; status: number; error: string } {
  if (!session || !session.userId) {
    return { ok: false, status: 401, error: 'جلسة تسجيل الدخول غير صالحة أو منتهية' };
  }
  if (session.role !== 'owner') {
    return { ok: false, status: 403, error: 'غير مصرح: هذا الإجراء محصور حصراً بحساب مالك المنصة (Owner)' };
  }
  // Double-verify against persistent database record to prevent token forging or stale role
  const ownerRecord = queryOne(
    db,
    "SELECT id, username, role, is_banned FROM users WHERE id = ?",
    [session.userId]
  );
  if (!ownerRecord || ownerRecord.role !== 'owner' || ownerRecord.is_banned === 1) {
    return { ok: false, status: 403, error: 'غير مصرح: هذا الإجراء محصور بحساب مالك المنصة (Owner)' };
  }
  return { ok: true, status: 200, error: '' };
}

// Owner-only middleware
async function requireOwner(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).user as UserSession;
  const db = await getDb();
  const check = verifyOwnerHegazy(db, session);
  if (!check.ok) {
    return res.status(check.status).json({ error: check.error });
  }
  next();
}

async function broadcastOnlineStatus(userId: string, isOnline: boolean, customActivityStatus?: string) {
  let userDetails: any = null;
  if (isOnline) {
    try {
      const db = await getDb();
      const u = queryOne(
        db,
        `SELECT u.id, u.username, u.role, u.gender, u.country, u.bio, u.avatar_url, u.activity_status,
                u.level, u.xp, u.vip_level, u.is_guest,
                MAX(CASE WHEN pin.id IS NOT NULL THEN 1 ELSE 0 END) as is_pinned
         FROM users u
         LEFT JOIN user_inventory pin ON u.id = pin.user_id AND pin.is_equipped = 1
           AND (pin.expires_at IS NULL OR pin.expires_at > CURRENT_TIMESTAMP)
           AND pin.item_id IN (SELECT id FROM shop_items WHERE type = 'pin_profile')
         WHERE u.id = ?
         GROUP BY u.id`,
        [userId]
      );

      if (u) {
        const inv = queryAll(
          db,
          `SELECT si.name, si.icon, si.type, si.metadata_json
           FROM user_inventory ui
           JOIN shop_items si ON ui.item_id = si.id
           WHERE ui.user_id = ? AND ui.is_equipped = 1
             AND (ui.expires_at IS NULL OR ui.expires_at > CURRENT_TIMESTAMP)`,
          [userId]
        );

        let equippedBadge: string | null = null;
        let equippedFrame: string | null = null;
        for (const item of inv) {
          if (item.type === 'badge') equippedBadge = item.icon || item.name;
          if (item.type === 'card_frame') {
            try {
              const meta = JSON.parse(item.metadata_json || '{}');
              equippedFrame = meta.frameStyle || 'gold';
            } catch {
              equippedFrame = 'gold';
            }
          }
        }

        userDetails = {
          id: u.id,
          username: u.username,
          role: u.role,
          gender: u.gender,
          country: u.country,
          bio: u.bio || '',
          avatarUrl: u.avatar_url || '',
          activityStatus: customActivityStatus !== undefined ? customActivityStatus : (u.activity_status || ''),
          level: u.is_guest === 1 ? 0 : u.level,
          xp: u.is_guest === 1 ? 0 : u.xp,
          vipLevel: u.is_guest === 1 ? 'none' : u.vip_level,
          isGuest: u.is_guest === 1,
          isPinned: u.is_pinned === 1,
          equippedBadge,
          equippedFrame,
          isOnline: true,
          lastActiveAt: new Date().toISOString()
        };
      }
    } catch (e) {
      console.error('Error fetching user presence data:', e);
    }
  }

  const payload = JSON.stringify({
    type: 'presence:update',
    userId,
    isOnline,
    user: userDetails
  });

  try {
    const db = await getDb();
    const userPrivacy = queryOne(db, "SELECT privacy_online_status FROM users WHERE id = ?", [userId]);
    const hideOnline = userPrivacy?.privacy_online_status === 'nobody';

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        const targetUserId = socketUserMap.get(client);
        if (targetUserId) {
          if (targetUserId === userId) {
            client.send(payload);
            continue;
          }
          if (hideOnline && isOnline) {
            // User requested online status to be hidden from others
            continue;
          }
          const isBlocked = queryOne(
            db,
            "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
            [userId, targetUserId, targetUserId, userId]
          );
          if (isBlocked) {
            continue;
          }
        }
        client.send(payload);
      }
    }
  } catch (err) {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

function sendToUser(userId: string, messageObj: any) {
  const sockets = connectedSockets.get(userId);
  if (sockets) {
    const payload = JSON.stringify(messageObj);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}

function broadcastToRoom(db: any, roomId: string, messageObj: any, excludeUserId?: string) {
  const members = queryAll(db, "SELECT user_id FROM room_members WHERE room_id = ?", [roomId]);
  const payload = JSON.stringify(messageObj);
  for (const m of members) {
    if (m.user_id !== excludeUserId) {
      const sockets = connectedSockets.get(m.user_id);
      if (sockets) {
        for (const ws of sockets) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(payload);
          }
        }
      }
    }
  }
}

function broadcastAudioState(db: any, roomId: string) {
  const speakers = queryAll(
    db,
    `SELECT a.user_id, a.is_speaking, a.is_muted, u.username, u.avatar_url, u.gender, u.role
     FROM active_audio_speakers a
     JOIN users u ON a.user_id = u.id
     WHERE a.room_id = ?
     ORDER BY a.joined_at ASC`,
    [roomId]
  );
  broadcastToRoom(db, roomId, {
    type: 'audio:state',
    roomId,
    speakers
  });
}

// ==========================================
// REAL-TIME MULTIPLAYER TRUTH OR DARE STATE
// ==========================================
interface TodPlayer {
  userId: string;
  username: string;
  avatarUrl?: string;
  gender?: string;
  score: number;
}

interface TodMultiplayerState {
  players: TodPlayer[];
  turnUserId: string | null;
  targetUserId: string | null;
  state: 'waiting' | 'spinning' | 'choosing' | 'answering' | 'completed';
  currentType?: 'truth' | 'dare';
  currentQuestion?: string;
  currentAnswer?: string;
}

const todMultiplayerPlayers = new Map<string, TodPlayer>();
let todState: TodMultiplayerState = {
  players: [],
  turnUserId: null,
  targetUserId: null,
  state: 'waiting'
};

function broadcastTodState() {
  todState.players = Array.from(todMultiplayerPlayers.values());
  const payload = JSON.stringify({
    type: 'game:tod_state',
    state: todState
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Periodic heartbeat keepalive to prevent zombie sessions (30s interval)
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const ws = client as any;
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Random Chat Matchmaking Waiters Queue
export interface RandomChatWaiter {
  userId: string;
  username: string;
  gender: string;
  country: string;
  interests: string[];
  type: 'text' | 'voice' | 'video';
  targetGender: string;
  targetCountry: string;
  targetInterests: string[];
  queuedAt: number;
}

const randomChatWaiters = new Map<string, RandomChatWaiter>();

// WebSocket Connection handler
wss.on('connection', async (ws: WebSocket, req: http.IncomingMessage) => {
  (ws as any).isAlive = true;
  ws.on('pong', () => {
    (ws as any).isAlive = true;
  });
  const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
  const token = urlParams.get('token');

  if (!token) {
    ws.close(4001, 'No token');
    return;
  }

  const db = await getDb();
  const user = authenticateToken(db, token);
  if (!user) {
    ws.close(4002, 'Invalid session');
    return;
  }

  if (!connectedSockets.has(user.userId)) {
    connectedSockets.set(user.userId, new Set());
  }
  const userSockets = connectedSockets.get(user.userId)!;
  const wasOffline = userSockets.size === 0;
  userSockets.add(ws);
  socketUserMap.set(ws, user.userId);

  // Update session online status
  db.run("UPDATE sessions SET is_online = 1, last_active_at = CURRENT_TIMESTAMP WHERE user_id = ?", [user.userId]);
  saveDb();

  // If user just came online, broadcast presence update immediately
  if (wasOffline) {
    broadcastOnlineStatus(user.userId, true);
  }

// Track last activity update timestamp to prevent excessive disk writes
const userLastActiveMap = new Map<string, number>();

function touchUserActivity(db: any, userId: string) {
  const now = Date.now();
  const last = userLastActiveMap.get(userId) || 0;
  if (now - last > 60000) {
    userLastActiveMap.set(userId, now);
    db.run("UPDATE sessions SET is_online = 1, last_active_at = CURRENT_TIMESTAMP WHERE user_id = ?", [userId]);
    saveDb();
  }
}

  ws.on('message', async (data: string) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'presence:track') {
        touchUserActivity(db, user.userId);
        if (msg.state?.activityStatus !== undefined) {
          db.run("UPDATE users SET activity_status = ? WHERE id = ?", [msg.state.activityStatus, user.userId]);
          saveDb();
        }

        if (msg.channel) {
          const payload = JSON.stringify({
            type: 'presence:update',
            channel: msg.channel,
            userId: user.userId,
            isOnline: true,
            user: {
              ...(msg.state || {}),
              id: user.userId,
              isOnline: true
            }
          });
          for (const client of wss.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          }
        } else {
          broadcastOnlineStatus(user.userId, true, msg.state?.activityStatus);
        }
      } else if (msg.type === 'presence:untrack') {
        if (msg.channel) {
          const payload = JSON.stringify({
            type: 'presence:update',
            channel: msg.channel,
            userId: user.userId,
            isOnline: false,
            user: { id: user.userId, isOnline: false }
          });
          for (const client of wss.clients) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          }
        } else {
          broadcastOnlineStatus(user.userId, false);
        }
      } else if (msg.type === 'typing:start' || msg.type === 'typing:stop') {
        if (msg.recipientId) {
          sendToUser(msg.recipientId, {
            type: msg.type,
            senderId: user.userId,
            conversationId: msg.conversationId
          });
        } else if (msg.roomId) {
          broadcastToRoom(db, msg.roomId, {
            type: msg.type,
            senderId: user.userId,
            username: user.username,
            roomId: msg.roomId
          }, user.userId);
        }
      } else if (msg.type === 'audio:join') {
        db.run(
          "INSERT OR REPLACE INTO active_audio_speakers (room_id, user_id, is_speaking, is_muted, joined_at) VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP)",
          [msg.roomId, user.userId]
        );
        saveDb();
        broadcastAudioState(db, msg.roomId);
      } else if (msg.type === 'audio:leave') {
        db.run("DELETE FROM active_audio_speakers WHERE room_id = ? AND user_id = ?", [msg.roomId, user.userId]);
        saveDb();
        broadcastAudioState(db, msg.roomId);
      } else if (msg.type === 'audio:mute_toggle') {
        db.run(
          "UPDATE active_audio_speakers SET is_muted = CASE WHEN is_muted = 1 THEN 0 ELSE 1 END WHERE room_id = ? AND user_id = ?",
          [msg.roomId, user.userId]
        );
        saveDb();
        broadcastAudioState(db, msg.roomId);
      } else if (msg.type === 'audio:speaking_state') {
        db.run(
          "UPDATE active_audio_speakers SET is_speaking = ? WHERE room_id = ? AND user_id = ?",
          [msg.isSpeaking ? 1 : 0, msg.roomId, user.userId]
        );
        broadcastAudioState(db, msg.roomId);
      } else if (msg.type === 'audio:signal') {
        if (msg.targetUserId) {
          sendToUser(msg.targetUserId, {
            type: 'audio:signal',
            fromUserId: user.userId,
            fromUsername: user.username,
            signal: msg.signal,
            roomId: msg.roomId
          });
        }
      } else if (msg.type === 'game:tod_join') {
        const userProfile = queryOne(db, "SELECT username, avatar_url, gender FROM users WHERE id = ?", [user.userId]);
        todMultiplayerPlayers.set(user.userId, {
          userId: user.userId,
          username: userProfile?.username || user.username,
          avatarUrl: userProfile?.avatar_url,
          gender: userProfile?.gender,
          score: 0
        });
        if (!todState.turnUserId) {
          todState.turnUserId = user.userId;
        }
        broadcastTodState();
      } else if (msg.type === 'game:tod_leave') {
        todMultiplayerPlayers.delete(user.userId);
        if (todState.turnUserId === user.userId) {
          const remaining = Array.from(todMultiplayerPlayers.keys());
          todState.turnUserId = remaining.length > 0 ? remaining[0] : null;
        }
        if (todState.targetUserId === user.userId) {
          todState.targetUserId = null;
          todState.state = 'waiting';
        }
        broadcastTodState();
      } else if (msg.type === 'game:tod_spin') {
        const playerList = Array.from(todMultiplayerPlayers.values());
        if (playerList.length > 0) {
          let target = playerList[Math.floor(Math.random() * playerList.length)];
          if (playerList.length > 1 && target.userId === user.userId) {
            const others = playerList.filter(p => p.userId !== user.userId);
            target = others[Math.floor(Math.random() * others.length)];
          }
          todState.state = 'choosing';
          todState.turnUserId = user.userId;
          todState.targetUserId = target.userId;
          todState.currentQuestion = undefined;
          todState.currentType = undefined;
          todState.currentAnswer = undefined;

          const payload = JSON.stringify({
            type: 'game:tod_spun',
            spinnerId: user.userId,
            targetUserId: target.userId,
            targetUsername: target.username,
            angle: Math.floor(Math.random() * 360) + 1440
          });
          for (const client of wss.clients) {
            if (client.readyState === WebSocket.OPEN) client.send(payload);
          }
          broadcastTodState();
        }
      } else if (msg.type === 'game:tod_choose') {
        const chosenType = msg.choice === 'dare' ? 'dare' : 'truth';
        const item = queryOne(db, "SELECT * FROM truth_or_dare_items WHERE type = ? ORDER BY RANDOM() LIMIT 1", [chosenType]);
        if (item) {
          todState.state = 'answering';
          todState.currentType = chosenType;
          todState.currentQuestion = item.question;
          broadcastTodState();
        }
      } else if (msg.type === 'game:tod_answer') {
        todState.state = 'completed';
        todState.currentAnswer = (msg.answer || '').slice(0, 300);
        const player = todMultiplayerPlayers.get(user.userId);
        if (player) {
          player.score += 10;
        }
        if (!user.isGuest) {
          addXp(db, user.userId, 15);
        }
        broadcastTodState();
      } else if (msg.type === 'game:tod_reaction') {
        const reactionPayload = JSON.stringify({
          type: 'game:tod_reaction',
          userId: user.userId,
          username: user.username,
          reaction: msg.reaction || '🔥'
        });
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) client.send(reactionPayload);
        }
      } else if (msg.type === 'random_chat:signal') {
        if (msg.targetUserId) {
          sendToUser(msg.targetUserId, {
            type: 'random_chat:signal',
            fromUserId: user.userId,
            signal: msg.signal,
            sessionId: msg.sessionId
          });
        }
      } else if (msg.type === 'random_chat:message') {
        if (msg.targetUserId) {
          sendToUser(msg.targetUserId, {
            type: 'random_chat:message',
            fromUserId: user.userId,
            text: msg.text,
            sessionId: msg.sessionId,
            timestamp: new Date().toISOString()
          });
        }
      } else if (msg.type === 'random_chat:typing') {
        if (msg.targetUserId) {
          sendToUser(msg.targetUserId, {
            type: 'random_chat:typing',
            fromUserId: user.userId,
            isTyping: !!msg.isTyping,
            sessionId: msg.sessionId
          });
        }
      } else if (msg.type === 'random_chat:ended') {
        if (msg.targetUserId) {
          sendToUser(msg.targetUserId, {
            type: 'random_chat:ended',
            fromUserId: user.userId,
            sessionId: msg.sessionId,
            reason: msg.reason || 'partner_ended'
          });
        }
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    socketUserMap.delete(ws);
    randomChatWaiters.delete(user.userId);
    // Remove user from any audio rooms on disconnect
    db.run("DELETE FROM active_audio_speakers WHERE user_id = ?", [user.userId]);

    // Remove user from multiplayer Truth or Dare session
    if (todMultiplayerPlayers.has(user.userId)) {
      todMultiplayerPlayers.delete(user.userId);
      if (todState.turnUserId === user.userId) {
        const remaining = Array.from(todMultiplayerPlayers.keys());
        todState.turnUserId = remaining.length > 0 ? remaining[0] : null;
      }
      broadcastTodState();
    }
    const userSet = connectedSockets.get(user.userId);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) {
        connectedSockets.delete(user.userId);
        db.run("UPDATE sessions SET is_online = 0, last_active_at = CURRENT_TIMESTAMP WHERE user_id = ?", [user.userId]);
        saveDb();
        broadcastOnlineStatus(user.userId, false);
      }
    }
  });
});

// ==========================================
// 1. AUTHENTICATION & REGISTRATION
// ==========================================

// Automatic Server-Side Country Detection via Network IP
app.get('/api/geo/detect', async (req: Request, res: Response) => {
  try {
    const geo = await detectUserCountry(req);
    return res.json({
      success: true,
      country: geo.country,
      countryCode: geo.countryCode,
      detectedAutomatically: geo.detectedAutomatically,
      method: geo.method
    });
  } catch (error) {
    console.error('Geo detect error:', error);
    return res.json({
      success: true,
      country: 'مصر',
      countryCode: 'EG',
      detectedAutomatically: false,
      method: 'default_fallback'
    });
  }
});

// Register New User
app.post('/api/auth/register', registerRateLimiter, async (req: Request, res: Response) => {
  try {
    const {
      username,
      email,
      password,
      dateOfBirth,
      gender,
      country,
      bio,
      interests,
      ownerKey,
      isManualCountry,
      termsAgreed
    } = req.body;

    if (!username || !email || !password || !dateOfBirth || !gender) {
      return res.status(400).json({ error: 'يرجى استكمال جميع البيانات المطلوبة بما فيها البريد الإلكتروني' });
    }

    // MANDATORY TERMS & CONDITIONS CONSENT (Server-Side Verification)
    if (termsAgreed !== true && termsAgreed !== 'true' && termsAgreed !== 1) {
      return res.status(400).json({
        error: 'يجب الموافقة الإلزامية على الشروط والأحكام وسياسة الخصوصية وسياسة الاستخدام المقبول لمنصة فضفضه.'
      });
    }

    // Clean and validate email
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صالحة' });
    }

    // Clean and validate username
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });
    }

    // MANDATORY 18+ REQUIREMENT
    if (!validate18Plus(dateOfBirth)) {
      return res.status(403).json({
        error: 'عذراً، يجب أن يكون عمرك 18 عاماً فما فوق للانضمام إلى منصة فضفضه.'
      });
    }

    // AUTOMATIC NETWORK COUNTRY DETECTION (Server-side)
    const detectedGeo = await detectUserCountry(req);
    let finalCountry = detectedGeo.country;
    let finalCountryCode = detectedGeo.countryCode;

    // Allow user to correct country manually if automatic detection is wrong (e.g. VPN or travel)
    if (isManualCountry && country) {
      const resolved = resolveArabicCountry(country);
      finalCountry = resolved.country;
      finalCountryCode = resolved.countryCode;
    }

    const db = await getDb();

    // Check if username already exists
    const existingUser = queryOne(db, "SELECT id FROM users WHERE LOWER(username) = LOWER(?)", [trimmedUsername]);
    if (existingUser) {
      return res.status(409).json({ error: 'اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم آخر' });
    }

    // Check if email already registered
    const existingEmail = queryOne(db, "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND email != ''", [cleanEmail]);
    if (existingEmail) {
      return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل لحساب آخر' });
    }

    // OWNER PROTECTION:
    // Username "Hegazy" is permanently reserved for the platform Owner!
    // Never allow registration with this username or assigning role 'owner' via register API!
    if (trimmedUsername.toLowerCase() === 'hegazy') {
      return res.status(403).json({
        error: 'اسم المستخدم "Hegazy" محجوز حصرياً لمالك ومؤسس المنصة ولا يمكن التسجيل به.'
      });
    }
    const role = 'user';

    const { hash, salt } = hashPassword(password);
    const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const referralCode = 'FAD-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    db.run(
      `INSERT INTO users (
        id, username, email, email_verified, email_verified_at, password_hash, salt, role, gender, country, country_code, detected_country,
        date_of_birth, bio, referral_code, coins, xp, level, streak, is_guest
      ) VALUES (?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 150, 0, 1, 1, 0)`,
      [
        userId,
        trimmedUsername,
        cleanEmail,
        hash,
        salt,
        role,
        gender,
        finalCountry,
        finalCountryCode,
        detectedGeo.country,
        dateOfBirth,
        bio || '',
        referralCode
      ]
    );

    // Save interests if provided
    if (Array.isArray(interests)) {
      for (const item of interests) {
        db.run("INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?)", [userId, item]);
      }
    }

    // Record mandatory legal consent
    const termsId = 'trm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const clientIp = ((req.headers['x-forwarded-for'] as string) || req.ip || '').split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] as string) || '';
    db.run(
      `INSERT INTO terms_agreements (id, user_id, guest_session_id, is_guest, agreed_at, terms_version, ip_address, user_agent)
       VALUES (?, ?, '', 0, CURRENT_TIMESTAMP, '1.0', ?, ?)`,
      [termsId, userId, clientIp, userAgent]
    );
    db.run("UPDATE users SET terms_agreed = 1, terms_agreed_at = CURRENT_TIMESTAMP, terms_version = '1.0' WHERE id = ?", [userId]);

    // Create session token
    const token = createSession(db, userId);

    // Initial welcome notification
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
    db.run(
      `INSERT INTO notifications (id, user_id, type, title, body, link)
       VALUES (?, ?, 'welcome', 'مرحباً بك في فضفضه! 🌹', 'يسعدنا انضمامك إلى مجتمع فضفضه. يرجى تأكيد بريدك الإلكتروني لتفعيل كامل الميزات.', '/profile')`,
      [notifId, userId]
    );

    saveDb();

    // Dispatch real email verification
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const vfyRes = await createAndSendVerification(db, userId, cleanEmail, trimmedUsername, baseUrl);

    return res.json({
      success: true,
      token,
      requireEmailVerification: true,
      user: {
        id: userId,
        username: trimmedUsername,
        email: cleanEmail,
        emailVerified: false,
        emailVerifiedAt: null,
        role,
        gender,
        country: finalCountry,
        countryCode: finalCountryCode,
        detectedCountry: detectedGeo.country,
        bio: bio || '',
        level: 1,
        coins: 150,
        streak: 1,
        vipLevel: 'none',
        isGuest: false
      }
    });
  } catch (error: any) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء إنشاء الحساب' });
  }
});

// Login
app.post('/api/auth/login', loginRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });
    }

    const db = await getDb();
    const user = queryOne(
      db,
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR (LOWER(email) = LOWER(?) AND email != '')",
      [username.trim(), username.trim()]
    );

    if (!user) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    if (user.is_banned === 1) {
      return res.status(403).json({
        error: `تم إيقاف هذا الحساب. السبب: ${user.ban_reason || 'مخالفة شروط الاستخدام'}`
      });
    }

    const valid = verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    // Check daily streak and award login XP/coins
    checkDailyStreak(db, user.id);

    const token = createSession(db, user.id);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
        emailVerified: user.email_verified === 1,
        emailVerifiedAt: user.email_verified_at || null,
        role: user.role,
        gender: user.gender,
        country: user.country,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        level: user.level,
        coins: user.coins,
        xp: user.xp,
        streak: user.streak,
        vipLevel: user.vip_level,
        isGuest: false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// ==========================================
// EMAIL VERIFICATION ENDPOINTS
// ==========================================

// Verify email by clicking link (GET)
app.get('/api/auth/verify-email', async (req: Request, res: Response) => {
  try {
    const token = (req.query.token as string || '').trim();
    if (!token) {
      return res.redirect('/verify-email?status=error&message=' + encodeURIComponent('رمز التحقق مفقود'));
    }

    const db = await getDb();
    const result = verifyTokenOrCode(db, token);

    if (result.success && result.user) {
      // Send realtime notification or update if active
      return res.redirect(`/verify-email?status=success&username=${encodeURIComponent(result.user.username)}`);
    } else {
      return res.redirect(`/verify-email?status=error&message=${encodeURIComponent(result.error || 'رمز التحقق غير صالح أو منتهي')}`);
    }
  } catch (error: any) {
    console.error('Email verification error:', error);
    return res.redirect('/verify-email?status=error&message=' + encodeURIComponent('تعذر التحقق من البريد'));
  }
});

// Verify email by token or 6-digit code (POST)
app.post('/api/auth/verify-email', emailVerifyRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, code } = req.body;
    const input = (token || code || '').trim();

    if (!input) {
      return res.status(400).json({ error: 'يرجى إدخال رمز التحقق المكون من 6 أرقام أو رابط التحقق' });
    }

    const db = await getDb();
    const result = verifyTokenOrCode(db, input);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.json({
      success: true,
      message: 'تم تأكيد البريد الإلكتروني بنجاح! حسابك مفعّل بالكامل الآن 🌟',
      user: result.user
    });
  } catch (error) {
    console.error('Verify email POST error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء التحقق من البريد الإلكتروني' });
  }
});

// Resend verification email
app.post('/api/auth/resend-verification', emailVerifyRateLimiter, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    let targetUser: any = null;

    // Check if authenticated
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.query.token as string);
    if (token) {
      const session = authenticateToken(db, token);
      if (session) {
        targetUser = queryOne(db, "SELECT id, username, email, email_verified FROM users WHERE id = ?", [session.userId]);
      }
    }

    if (!targetUser && req.body.email) {
      const cleanEmail = req.body.email.trim().toLowerCase();
      targetUser = queryOne(db, "SELECT id, username, email, email_verified FROM users WHERE LOWER(email) = LOWER(?)", [cleanEmail]);
    } else if (!targetUser && req.body.username) {
      const cleanUser = req.body.username.trim();
      targetUser = queryOne(db, "SELECT id, username, email, email_verified FROM users WHERE LOWER(username) = LOWER(?)", [cleanUser]);
    }

    if (!targetUser) {
      return res.status(404).json({ error: 'لم يتم العثور على الحساب المطلوب' });
    }

    if (!targetUser.email) {
      return res.status(400).json({ error: 'لا يوجد بريد إلكتروني مسجل لهذا الحساب' });
    }

    if (targetUser.email_verified === 1) {
      return res.json({ success: true, message: 'هذا البريد الإلكتروني مؤكد ومفعّل بالفعل' });
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    const sendRes = await createAndSendVerification(db, targetUser.id, targetUser.email, targetUser.username, baseUrl);
    if (!sendRes.success) {
      return res.status(500).json({ error: 'تعذر إرسال رسالة التحقق، يرجى المحاولة لاحقاً' });
    }

    return res.json({
      success: true,
      message: `تم إرسال رسالة تحقق جديدة إلى البريد الإلكتروني (${targetUser.email}) بنجاح.`
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'تعذر إعادة إرسال رسالة التحقق' });
  }
});

// Update email address (with re-verification requirement)
app.post('/api/users/me/email', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني الجديد وكلمة المرور' });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صالحة' });
    }

    const db = await getDb();
    const user = queryOne(db, "SELECT password_hash, salt, email FROM users WHERE id = ?", [session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (!verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    if (user.email && user.email.toLowerCase() === cleanEmail) {
      return res.status(400).json({ error: 'هذا البريد هو نفسه البريد الحالي للحساب' });
    }

    // Check if new email is used by another account
    const existing = queryOne(db, "SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?", [cleanEmail, session.userId]);
    if (existing) {
      return res.status(409).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل بحساب آخر' });
    }

    // Re-verification requirement: Reset email_verified to 0
    db.run(
      "UPDATE users SET email = ?, email_verified = 0, email_verified_at = NULL WHERE id = ?",
      [cleanEmail, session.userId]
    );
    saveDb();

    // Dispatch verification to new email
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    await createAndSendVerification(db, session.userId, cleanEmail, session.username, baseUrl);

    return res.json({
      success: true,
      message: 'تم تحديث البريد الإلكتروني بنجاح. يلزم التحقق من البريد الجديد لتفعيل حسابك بالكامل.',
      email: cleanEmail,
      emailVerified: false
    });
  } catch (error) {
    console.error('Update email error:', error);
    return res.status(500).json({ error: 'تعذر تحديث البريد الإلكتروني' });
  }
});

// ==========================================
// PASSWORD RESET ENDPOINTS
// ==========================================

// Request password reset (Forgot Password)
app.post('/api/auth/forgot-password', forgotPasswordRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const db = await getDb();
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;

    const result = await createAndSendPasswordReset(db, email, baseUrl);
    return res.json(result);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Generic message to avoid email enumeration
    return res.json({
      success: true,
      message: 'إذا كان هذا البريد مسجلاً لدينا، فستصلك رسالة تحتوي على تعليمات ورابط إعادة تعيين كلمة المرور.'
    });
  }
});

// Verify reset token validity
app.get('/api/auth/verify-reset-token', async (req: Request, res: Response) => {
  try {
    const token = (req.query.token as string || '').trim();
    const db = await getDb();
    const result = verifyPasswordResetToken(db, token);

    if (!result.valid) {
      return res.status(400).json({ valid: false, error: result.error });
    }

    return res.json({
      valid: true,
      username: result.username,
      email: result.email
    });
  } catch (error) {
    console.error('Verify reset token error:', error);
    return res.status(500).json({ valid: false, error: 'حدث خطأ أثناء فحص الرابط' });
  }
});

// Reset Password with new password
app.post('/api/auth/reset-password', resetPasswordRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'رمز إعادة التعيين وكلمة المرور الجديدة مطلوبان' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تتكون من 6 أحرف أو أرقام على الأقل' });
    }

    const db = await getDb();
    const tokenRecord = verifyPasswordResetToken(db, token);
    if (!tokenRecord.valid || !tokenRecord.userId) {
      return res.status(400).json({ error: tokenRecord.error || 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' });
    }

    // Verify not reusing previous password
    const user = queryOne(
      db,
      "SELECT id, username, password_hash, salt, role FROM users WHERE id = ?",
      [tokenRecord.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (verifyPassword(newPassword, user.password_hash, user.salt)) {
      return res.status(400).json({
        error: 'لا يمكن استخدام كلمة المرور القديمة نفسها. يرجى اختيار كلمة مرور جديدة ومختلفة.'
      });
    }

    // Hash new password
    const { hash, salt } = hashPassword(newPassword);

    // Update password hash server-side only
    db.run("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", [hash, salt, user.id]);

    // Mark reset token as used (single use guarantee)
    db.run("UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE token = ?", [token]);

    // Invalidate existing sessions for account security
    db.run("DELETE FROM sessions WHERE user_id = ?", [user.id]);

    saveDb();

    console.log(`[Password Reset] Password changed successfully for user: ${user.username} (ID: ${user.id})`);

    return res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' });
  }
});

// Update notification sound settings
app.put('/api/users/me/settings/sound', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { notificationSound, soundEnabled } = req.body;

    const sound = typeof notificationSound === 'string' ? notificationSound : 'chime';
    const enabled = soundEnabled ? 1 : 0;

    const db = await getDb();
    db.run(
      "UPDATE users SET notification_sound = ?, sound_enabled = ? WHERE id = ?",
      [sound, enabled, session.userId]
    );
    saveDb();

    return res.json({ success: true, notificationSound: sound, soundEnabled: enabled === 1 });
  } catch (error) {
    console.error('Update sound setting error:', error);
    return res.status(500).json({ error: 'تعذر حفظ إعدادات الصوت' });
  }
});

// Guest Entry
app.post('/api/auth/guest', async (req: Request, res: Response) => {
  try {
    const { nickname, gender, country, isManualCountry, termsAgreed } = req.body;

    // MANDATORY TERMS & CONDITIONS CONSENT (Server-Side Verification)
    if (termsAgreed !== true && termsAgreed !== 'true' && termsAgreed !== 1) {
      return res.status(400).json({
        error: 'يجب الموافقة الإلزامية على الشروط والأحكام وسياسة الاستخدام المقبول للدخول كضيف.'
      });
    }

    const cleanNick = (nickname || 'زائر').trim();
    const cleanGender = gender === 'female' ? 'female' : 'male';

    // AUTOMATIC NETWORK COUNTRY DETECTION (Server-side)
    const detectedGeo = await detectUserCountry(req);
    let finalCountry = detectedGeo.country;
    let finalCountryCode = detectedGeo.countryCode;

    // Allow user to correct country manually if needed
    if (isManualCountry && country) {
      const resolved = resolveArabicCountry(country);
      finalCountry = resolved.country;
      finalCountryCode = resolved.countryCode;
    }

    const db = await getDb();

    // Fetch guest settings
    const limitSetting = queryOne(db, "SELECT value FROM system_settings WHERE key = 'guest_message_limit'");
    const maxMessages = parseInt(limitSetting?.value || '500', 10);

    const guestId = 'gst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const guestUsername = `${cleanNick}_${Math.floor(1000 + Math.random() * 9000)}`;

    const { hash, salt } = hashPassword('guest_session_secret_' + Math.random());

    db.run(
      `INSERT INTO users (
        id, username, password_hash, salt, role, gender, country, country_code, detected_country,
        date_of_birth, coins, xp, level, streak, is_guest, guest_messages_remaining
      ) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, '2000-01-01', 0, 0, 0, 0, 1, ?)`,
      [
        guestId,
        guestUsername,
        hash,
        salt,
        cleanGender,
        finalCountry,
        finalCountryCode,
        detectedGeo.country,
        maxMessages
      ]
    );

    const token = createSession(db, guestId);

    // Record mandatory legal consent for guest session
    const termsId = 'trm_gst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const clientIp = ((req.headers['x-forwarded-for'] as string) || req.ip || '').split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] as string) || '';
    db.run(
      `INSERT INTO terms_agreements (id, user_id, guest_session_id, is_guest, agreed_at, terms_version, ip_address, user_agent)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, '1.0', ?, ?)`,
      [termsId, guestId, token, clientIp, userAgent]
    );

    return res.json({
      success: true,
      token,
      user: {
        id: guestId,
        username: guestUsername,
        role: 'user',
        gender: cleanGender,
        country: finalCountry,
        countryCode: finalCountryCode,
        detectedCountry: detectedGeo.country,
        bio: 'زائر في منصة فضفضه',
        level: 0,
        coins: 0,
        xp: 0,
        streak: 0,
        vipLevel: 'none',
        isGuest: true,
        guestMessagesRemaining: maxMessages
      }
    });
  } catch (error) {
    console.error('Guest entry error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء الدخول كزائر' });
  }
});

// Get Current Logged-in User
app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const user = queryOne(db, "SELECT * FROM users WHERE id = ?", [session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const unreadCount = queryOne(
      db,
      "SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0",
      [user.id]
    )?.c || 0;

    const unreadMsgs = queryOne(
      db,
      "SELECT COUNT(*) as c FROM private_messages WHERE recipient_id = ? AND is_read = 0",
      [user.id]
    )?.c || 0;

    const pendingFriendReqCount = queryOne(
      db,
      "SELECT COUNT(*) as c FROM friend_requests WHERE receiver_id = ? AND status = 'pending'",
      [user.id]
    )?.c || 0;

    const interestRows = queryAll(db, "SELECT interest FROM user_interests WHERE user_id = ?", [user.id]);
    const userInterests = interestRows.map(r => r.interest);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
        emailVerified: user.email_verified === 1,
        emailVerifiedAt: user.email_verified_at || null,
        displayName: user.display_name || user.username,
        role: user.role,
        isOwner: user.role === 'owner' || user.username?.toLowerCase() === 'hegazy',
        gender: user.gender,
        country: user.country,
        countryCode: user.country_code || ARABIC_TO_ISO[user.country] || 'EG',
        detectedCountry: user.detected_country || user.country,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        coverUrl: user.cover_url || '',
        dateOfBirth: user.date_of_birth,
        level: user.level,
        coins: user.coins,
        xp: user.xp,
        streak: user.streak,
        vipLevel: user.vip_level,
        vipExpiresAt: user.vip_expires_at || null,
        isGuest: user.is_guest === 1,
        guestMessagesRemaining: user.guest_messages_remaining,
        referralCode: user.referral_code,
        unreadNotifications: unreadCount,
        unreadMessages: unreadMsgs,
        pendingFriendRequests: pendingFriendReqCount,
        interests: userInterests,
        privacy: {
          messages: user.privacy_messages || 'everyone',
          friendRequests: user.privacy_friend_requests || 'everyone',
          storyVisibility: user.privacy_story_visibility || 'everyone',
          profileVisibility: user.privacy_profile_visibility || 'everyone',
          onlineStatus: user.privacy_online_status || 'everyone',
          lastSeen: user.privacy_last_seen || 'everyone'
        },
        media: {
          autoDownloadImages: user.media_auto_download_images !== 0,
          autoDownloadVideo: user.media_auto_download_video !== 0,
          quality: user.media_quality || 'high',
          autoplayVideo: user.media_autoplay_video !== 0,
          defaultViewOnce: user.media_default_view_once === 1
        },
        notificationSound: user.notification_sound || 'chime',
        soundEnabled: user.sound_enabled !== 0
      }
    });
  } catch (error) {
    console.error('Me error:', error);
    return res.status(500).json({ error: 'خطأ في جلب بيانات المستخدم' });
  }
});

// Logout
app.post('/api/auth/logout', requireAuth, async (req: Request, res: Response) => {
  const session = (req as any).user as UserSession;
  const db = await getDb();
  db.run("DELETE FROM sessions WHERE token = ?", [session.token]);
  saveDb();
  broadcastOnlineStatus(session.userId, false);
  return res.json({ success: true });
});

// ==========================================
// 2. ONLINE USERS ("المتصلون الآن")
// ==========================================
// CRITICAL DEFAULT SORTING:
// 1. Users from current user's country first.
// 2. Within that country: Females first, Males second.
// 3. Then users from other countries: Females first, Males second.

app.get('/api/users/online', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    const { search, country, gender, interest, sort } = req.query;

    let sql = `
      SELECT u.id, u.username, u.role, u.gender, u.country, u.bio, u.avatar_url, u.activity_status,
             u.level, u.xp, u.vip_level, u.is_guest,
             u.privacy_online_status, u.privacy_last_seen,
             MAX(s.is_online) as is_online,
             MAX(s.last_active_at) as last_active_at,
             MAX(CASE WHEN pin.id IS NOT NULL THEN 1 ELSE 0 END) as is_pinned
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id AND s.expires_at > CURRENT_TIMESTAMP
      LEFT JOIN user_inventory pin ON u.id = pin.user_id AND pin.is_equipped = 1
        AND (pin.expires_at IS NULL OR pin.expires_at > CURRENT_TIMESTAMP)
        AND pin.item_id IN (SELECT id FROM shop_items WHERE type = 'pin_profile')
      WHERE u.is_banned = 0 AND u.id != ?
        AND u.id NOT IN (SELECT blocked_user_id FROM blocks WHERE user_id = ?)
        AND u.id NOT IN (SELECT user_id FROM blocks WHERE blocked_user_id = ?)
    `;
    const params: any[] = [session.userId, session.userId, session.userId];

    if (search) {
      sql += ` AND LOWER(u.username) LIKE LOWER(?)`;
      params.push(`%${(search as string).trim()}%`);
    }

    if (country) {
      sql += ` AND u.country = ?`;
      params.push(country);
    }

    if (gender && (gender === 'female' || gender === 'male')) {
      sql += ` AND u.gender = ?`;
      params.push(gender);
    }

    sql += ` GROUP BY u.id`;

    // SORTING:
    // Pinned users (تثبيت الحساب) ALWAYS appear first at the top, followed by country and gender priority
    if (sort === 'level') {
      sql += `
        ORDER BY
          (CASE WHEN MAX(CASE WHEN pin.id IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 0 ELSE 1 END) ASC,
          u.level DESC, u.xp DESC
      `;
    } else if (sort === 'newest') {
      sql += `
        ORDER BY
          (CASE WHEN MAX(CASE WHEN pin.id IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 0 ELSE 1 END) ASC,
          u.created_at DESC
      `;
    } else {
      // MANDATORY DEFAULT SORTING:
      // 1. Pinned accounts ("تثبيت الحساب") first
      // 2. Current user's country first
      // 3. Female first, male second
      // 4. Other countries, female first, male second
      sql += `
        ORDER BY
          (CASE WHEN MAX(CASE WHEN pin.id IS NOT NULL THEN 1 ELSE 0 END) = 1 THEN 0 ELSE 1 END) ASC,
          (CASE WHEN u.country = ? THEN 0 ELSE 1 END) ASC,
          (CASE WHEN u.gender = 'female' THEN 0 ELSE 1 END) ASC,
          u.country ASC,
          (CASE WHEN MAX(s.is_online) = 1 THEN 0 ELSE 1 END) ASC,
          u.level DESC
      `;
      params.push(session.country);
    }

    sql += ` LIMIT 100`;

    const rows = queryAll(db, sql, params);

    // Fetch user interests & active shop items (badges & frames)
    const userIds = rows.map(r => r.id);
    let interestsMap: Record<string, string[]> = {};
    let badgesMap: Record<string, string> = {};
    let framesMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const interestRows = queryAll(
        db,
        `SELECT user_id, interest FROM user_interests WHERE user_id IN (${placeholders})`,
        userIds
      );
      for (const ir of interestRows) {
        if (!interestsMap[ir.user_id]) interestsMap[ir.user_id] = [];
        interestsMap[ir.user_id].push(ir.interest);
      }

      const invRows = queryAll(
        db,
        `SELECT ui.user_id, si.name, si.icon, si.type, si.metadata_json
         FROM user_inventory ui
         JOIN shop_items si ON ui.item_id = si.id
         WHERE ui.user_id IN (${placeholders}) AND ui.is_equipped = 1
           AND (ui.expires_at IS NULL OR ui.expires_at > CURRENT_TIMESTAMP)`,
        userIds
      );
      for (const inv of invRows) {
        if (inv.type === 'badge') {
          badgesMap[inv.user_id] = inv.icon || inv.name;
        } else if (inv.type === 'card_frame') {
          try {
            const meta = JSON.parse(inv.metadata_json || '{}');
            framesMap[inv.user_id] = meta.frameStyle || 'gold';
          } catch {
            framesMap[inv.user_id] = 'gold';
          }
        }
      }
    }

    const onlineUsers = rows.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      isOwner: u.role === 'owner' || u.username?.toLowerCase() === 'hegazy',
      gender: u.gender,
      country: u.country,
      bio: u.bio,
      avatarUrl: u.avatar_url,
      activityStatus: u.activity_status || '',
      level: u.is_guest === 1 ? 0 : u.level,
      vipLevel: u.is_guest === 1 ? 'none' : u.vip_level,
      isGuest: u.is_guest === 1,
      isPinned: u.is_pinned === 1,
      equippedBadge: u.is_guest === 1 ? null : (badgesMap[u.id] || null),
      equippedFrame: u.is_guest === 1 ? null : (framesMap[u.id] || null),
      isOnline: u.privacy_online_status === 'nobody' ? false : (u.is_online === 1 || isUserOnline(u.id)),
      lastActiveAt: u.privacy_last_seen === 'nobody' ? null : u.last_active_at,
      interests: interestsMap[u.id] || []
    }));

    return res.json({ users: onlineUsers, userCountry: session.country });
  } catch (error) {
    console.error('Online users error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء جلب قائمة المتصلين' });
  }
});

// Update user activity status
app.post('/api/users/activity-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { activityStatus } = req.body;
    const db = await getDb();
    const cleanStatus = (activityStatus || '').trim().slice(0, 50);

    db.run("UPDATE users SET activity_status = ? WHERE id = ?", [cleanStatus, session.userId]);
    saveDb();

    // Broadcast presence update with new activity status
    broadcastOnlineStatus(session.userId, true, cleanStatus);

    return res.json({ success: true, activityStatus: cleanStatus });
  } catch (error) {
    console.error('Update activity status error:', error);
    return res.status(500).json({ error: 'تعذر تحديث حالة النشاط' });
  }
});

// ==========================================
// 3. USER PROFILE & RELATIONSHIPS
// ==========================================

app.get('/api/users/:id/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const targetId = req.params.id;
    const db = await getDb();

    const user = queryOne(
      db,
      `SELECT id, username, role, gender, country, bio, avatar_url, level, xp, streak,
              vip_level, created_at, is_guest, privacy_messages, privacy_friend_requests,
              privacy_story_visibility, privacy_profile_visibility, privacy_online_status, privacy_last_seen
       FROM users WHERE id = ? AND is_banned = 0`,
      [targetId]
    );

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const isBlockedByMe = !!queryOne(
      db,
      "SELECT id FROM blocks WHERE user_id = ? AND blocked_user_id = ?",
      [session.userId, targetId]
    );

    const isBlockedByThem = !!queryOne(
      db,
      "SELECT id FROM blocks WHERE user_id = ? AND blocked_user_id = ?",
      [targetId, session.userId]
    );

    if (isBlockedByThem) {
      return res.json({
        user: {
          id: user.id,
          username: user.username,
          gender: user.gender,
          country: user.country,
          avatarUrl: '',
          bio: 'هذا الحساب غير متاح.',
          level: 1,
          xp: 0,
          streak: 0,
          vipLevel: 'none',
          createdAt: user.created_at,
          isGuest: false,
          isOnline: false,
          isBlockedByThem: true,
          interests: [],
          achievements: [],
          stats: {
            friendsCount: 0,
            followersCount: 0
          },
          relationships: {
            isFriend: false,
            friendRequestStatus: null,
            requestId: null,
            isFollowing: false,
            isBlocked: isBlockedByMe,
            isBlockedByThem: true,
            isMuted: false
          }
        }
      });
    }

    const interests = queryAll(db, "SELECT interest FROM user_interests WHERE user_id = ?", [targetId]).map(r => r.interest);
    const achievements = queryAll(
      db,
      `SELECT a.title, a.description, a.icon, ua.unlocked_at
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = ?`,
      [targetId]
    );

    // Relationship status
    const isFriend = !!queryOne(
      db,
      "SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
      [session.userId, targetId, targetId, session.userId]
    );

    const pendingRequest = queryOne(
      db,
      "SELECT id, sender_id FROM friend_requests WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND status = 'pending'",
      [session.userId, targetId, targetId, session.userId]
    );

    const isFollowing = !!queryOne(
      db,
      "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
      [session.userId, targetId]
    );

    const isMuted = !!queryOne(
      db,
      "SELECT id FROM mutes WHERE user_id = ? AND muted_user_id = ?",
      [session.userId, targetId]
    );

    // Public stats
    const friendsCount = queryOne(
      db,
      "SELECT COUNT(*) as c FROM friendships WHERE user_id = ? OR friend_id = ?",
      [targetId, targetId]
    )?.c || 0;

    const followersCount = queryOne(
      db,
      "SELECT COUNT(*) as c FROM follows WHERE following_id = ?",
      [targetId]
    )?.c || 0;

    const showOnline = user.privacy_online_status !== 'nobody';
    const showBio = user.privacy_profile_visibility !== 'friends' || isFriend || targetId === session.userId;

    return res.json({
      user: {
        ...user,
        isOwner: user.role === 'owner' || user.username?.toLowerCase() === 'hegazy',
        bio: showBio ? user.bio : '',
        isOnline: showOnline ? isUserOnline(targetId) : false,
        interests,
        achievements,
        stats: {
          friendsCount,
          followersCount
        },
        relationships: {
          isFriend,
          friendRequestStatus: pendingRequest ? (pendingRequest.sender_id === session.userId ? 'sent' : 'received') : null,
          requestId: pendingRequest?.id,
          isFollowing,
          isBlocked: isBlockedByMe,
          isBlockedByThem: false,
          isMuted
        }
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'خطأ في جلب بيانات الملف الشخصي' });
  }
});

// Update Profile & Preferences
app.put('/api/users/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const {
      displayName,
      bio,
      country,
      gender,
      birthDate,
      avatarUrl,
      coverUrl,
      interests,
      privacy,
      media
    } = req.body;
    const db = await getDb();

    let cleanCountry = country || null;
    let cleanCountryCode = null;
    if (country) {
      const resolved = resolveArabicCountry(country);
      cleanCountry = resolved.country;
      cleanCountryCode = resolved.countryCode;
    }

    db.run(
      `UPDATE users
       SET display_name = COALESCE(?, display_name),
           bio = COALESCE(?, bio),
           country = COALESCE(?, country),
           country_code = COALESCE(?, country_code),
           gender = COALESCE(?, gender),
           birth_date = COALESCE(?, birth_date),
           avatar_url = COALESCE(?, avatar_url),
           cover_url = COALESCE(?, cover_url),
           privacy_messages = COALESCE(?, privacy_messages),
           privacy_friend_requests = COALESCE(?, privacy_friend_requests),
           privacy_story_visibility = COALESCE(?, privacy_story_visibility),
           privacy_profile_visibility = COALESCE(?, privacy_profile_visibility),
           privacy_online_status = COALESCE(?, privacy_online_status),
           privacy_last_seen = COALESCE(?, privacy_last_seen),
           media_auto_download_images = COALESCE(?, media_auto_download_images),
           media_auto_download_video = COALESCE(?, media_auto_download_video),
           media_quality = COALESCE(?, media_quality),
           media_autoplay_video = COALESCE(?, media_autoplay_video),
           media_default_view_once = COALESCE(?, media_default_view_once)
       WHERE id = ?`,
      [
        displayName !== undefined ? displayName.trim() : null,
        bio !== undefined ? bio.trim() : null,
        cleanCountry,
        cleanCountryCode,
        gender || null,
        birthDate !== undefined ? birthDate : null,
        avatarUrl !== undefined ? avatarUrl : null,
        coverUrl !== undefined ? coverUrl : null,
        privacy?.messages || null,
        privacy?.friendRequests || null,
        privacy?.storyVisibility || null,
        privacy?.profileVisibility || null,
        privacy?.onlineStatus || null,
        privacy?.lastSeen || null,
        media?.autoDownloadImages !== undefined ? (media.autoDownloadImages ? 1 : 0) : null,
        media?.autoDownloadVideo !== undefined ? (media.autoDownloadVideo ? 1 : 0) : null,
        media?.quality || null,
        media?.autoplayVideo !== undefined ? (media.autoplayVideo ? 1 : 0) : null,
        media?.defaultViewOnce !== undefined ? (media.defaultViewOnce ? 1 : 0) : null,
        session.userId
      ]
    );

    if (Array.isArray(interests)) {
      db.run("DELETE FROM user_interests WHERE user_id = ?", [session.userId]);
      for (const item of interests) {
        if (item && item.trim()) {
          db.run("INSERT OR IGNORE INTO user_interests (user_id, interest) VALUES (?, ?)", [session.userId, item.trim()]);
        }
      }
    }

    saveDb();
    broadcastOnlineStatus(session.userId, isUserOnline(session.userId));
    return res.json({ success: true, message: 'تم تحديث الملف الشخصي والإعدادات بنجاح' });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تحديث الملف الشخصي' });
  }
});

// Change Password
app.post('/api/users/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'يرجى إدخال كلمة المرور الحالية والجديدة' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }

    const db = await getDb();
    const user = queryOne(db, "SELECT password_hash, salt FROM users WHERE id = ?", [session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (!verifyPassword(currentPassword, user.password_hash, user.salt)) {
      return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    const { hash, salt } = hashPassword(newPassword);
    db.run("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?", [hash, salt, session.userId]);
    saveDb();

    return res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح!' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء تغيير كلمة المرور' });
  }
});

// Get Active Sessions
app.get('/api/users/sessions', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const currentToken = req.headers.authorization?.slice(7) || '';
    const db = await getDb();

    const rows = queryAll(
      db,
      `SELECT token, created_at, last_active_at, is_online, device_info, ip_address
       FROM sessions
       WHERE user_id = ? AND expires_at > CURRENT_TIMESTAMP
       ORDER BY last_active_at DESC`,
      [session.userId]
    );

    const sessions = rows.map(r => ({
      id: r.token.slice(-8),
      isCurrent: r.token === currentToken,
      createdAt: r.created_at,
      lastActiveAt: r.last_active_at,
      isOnline: r.is_online === 1,
      deviceInfo: r.device_info || 'متصفح الويب',
      ipAddress: r.ip_address || 'محمي'
    }));

    return res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({ error: 'خطأ في جلب الجلسات النشطة' });
  }
});

// Revoke all other sessions
app.post('/api/users/sessions/revoke-others', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const currentToken = req.headers.authorization?.slice(7) || '';
    const db = await getDb();

    db.run(
      "DELETE FROM sessions WHERE user_id = ? AND token != ?",
      [session.userId, currentToken]
    );
    saveDb();

    return res.json({ success: true, message: 'تم تسجيل الخروج من كافة الأجهزة الأخرى بنجاح!' });
  } catch (error) {
    console.error('Revoke sessions error:', error);
    return res.status(500).json({ error: 'خطأ في إنهاء الجلسات الأخرى' });
  }
});

// Delete user account
app.delete('/api/users/account', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'يرجى إدخال كلمة المرور لتأكيد حذف الحساب' });
    }

    const db = await getDb();
    const user = queryOne(db, "SELECT password_hash, salt, role FROM users WHERE id = ?", [session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (user.role === 'owner') {
      return res.status(403).json({ error: 'لا يمكن حذف حساب المالك الأساسي للمنصة' });
    }

    if (!verifyPassword(password, user.password_hash, user.salt)) {
      return res.status(400).json({ error: 'كلمة المرور غير صحيحة' });
    }

    // Delete sessions and mark/clean user
    db.run("DELETE FROM sessions WHERE user_id = ?", [session.userId]);
    db.run("DELETE FROM users WHERE id = ?", [session.userId]);
    saveDb();

    broadcastOnlineStatus(session.userId, false);
    return res.json({ success: true, message: 'تم حذف الحساب بنجاح' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء حذف الحساب' });
  }
});

// Re-detect country automatically from current network IP
app.post('/api/users/profile/redetect-country', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const detectedGeo = await detectUserCountry(req);

    db.run(
      "UPDATE users SET country = ?, country_code = ?, detected_country = ? WHERE id = ?",
      [detectedGeo.country, detectedGeo.countryCode, detectedGeo.country, session.userId]
    );
    saveDb();

    return res.json({
      success: true,
      country: detectedGeo.country,
      countryCode: detectedGeo.countryCode,
      detectedAutomatically: detectedGeo.detectedAutomatically,
      message: `تم تحديث الدولة تلقائياً إلى: ${detectedGeo.country}`
    });
  } catch (error) {
    console.error('Redetect country error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء كشف الدولة' });
  }
});

// Friend Requests
app.post('/api/users/:id/friend-request', requireAuth, friendRequestRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const targetId = req.params.id;
    if (session.userId === targetId) {
      return res.status(400).json({ error: 'لا يمكنك إرسال طلب صداقة لنفسك' });
    }

    const db = await getDb();

    // 1. Block check (bidirectional)
    const isBlocked = queryOne(
      db,
      "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
      [session.userId, targetId, targetId, session.userId]
    );
    if (isBlocked) {
      return res.status(403).json({ error: 'لا يمكن إرسال طلب صداقة لهذا المستخدم نظراً لوجود حظر بين الحسابين.' });
    }

    // 2. Privacy check
    const targetUser = queryOne(db, "SELECT privacy_friend_requests FROM users WHERE id = ?", [targetId]);
    if (targetUser && (targetUser.privacy_friend_requests === 'none' || targetUser.privacy_friend_requests === 'nobody')) {
      return res.status(403).json({ error: 'هذا المستخدم يفضل عدم استقبال طلبات الصداقة وفقاً لإعدادات خصوصيته.' });
    }

    // 3. Already friends check
    const alreadyFriends = queryOne(
      db,
      "SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
      [session.userId, targetId, targetId, session.userId]
    );
    if (alreadyFriends) {
      return res.status(400).json({ error: 'أنتم أصدقاء بالفعل!' });
    }

    // 4. Existing pending requests check
    const existingReq = queryOne(
      db,
      "SELECT id, sender_id FROM friend_requests WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND status = 'pending'",
      [session.userId, targetId, targetId, session.userId]
    );
    if (existingReq) {
      if (existingReq.sender_id === session.userId) {
        return res.status(400).json({ error: 'لقد قمت بإرسال طلب صداقة لهذا المستخدم بالفعل وهو قيد الانتظار.' });
      } else {
        // Reverse request exists, auto-accept
        db.run("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", [existingReq.id]);
        const f1 = 'fr_' + Math.random().toString(36).substring(2, 9);
        const f2 = 'fr_' + Math.random().toString(36).substring(2, 9);
        db.run("INSERT OR IGNORE INTO friendships (id, user_id, friend_id) VALUES (?, ?, ?)", [f1, session.userId, targetId]);
        db.run("INSERT OR IGNORE INTO friendships (id, user_id, friend_id) VALUES (?, ?, ?)", [f2, targetId, session.userId]);
        saveDb();
        return res.json({ success: true, message: 'تم قبول طلب الصداقة المتبادل وأصبحتم أصدقاء الآن! 🎉' });
      }
    }

    const reqId = 'freq_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT OR REPLACE INTO friend_requests (id, sender_id, receiver_id, status) VALUES (?, ?, ?, 'pending')",
      [reqId, session.userId, targetId]
    );

    // Notify receiver
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'friend_request', 'طلب صداقة جديد 🤝', ?, '/friends')",
      [notifId, targetId, `أرسل لك ${session.username} طلب صداقة جديد.`]
    );

    sendToUser(targetId, {
      type: 'notification:new',
      notification: {
        id: notifId,
        type: 'friend_request',
        title: 'طلب صداقة جديد 🤝',
        body: `أرسل لك ${session.username} طلب صداقة جديد.`
      }
    });

    saveDb();
    return res.json({ success: true, message: 'تم إرسال طلب الصداقة بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إرسال طلب الصداقة' });
  }
});

app.post('/api/users/friend-request/:id/respond', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const requestId = req.params.id;
    const { action } = req.body; // 'accept' or 'reject'
    const db = await getDb();

    const request = queryOne(
      db,
      "SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ?",
      [requestId, session.userId]
    );

    if (!request) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (action === 'accept') {
      db.run("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", [requestId]);
      const f1 = 'fr_' + Math.random().toString(36).substring(2, 9);
      const f2 = 'fr_' + Math.random().toString(36).substring(2, 9);
      db.run("INSERT OR IGNORE INTO friendships (id, user_id, friend_id) VALUES (?, ?, ?)", [f1, session.userId, request.sender_id]);
      db.run("INSERT OR IGNORE INTO friendships (id, user_id, friend_id) VALUES (?, ?, ?)", [f2, request.sender_id, session.userId]);

      // Award XP (registered users only)
      if (!session.isGuest) {
        addXp(db, session.userId, 25);
      }
      const reqSender = queryOne(db, "SELECT is_guest FROM users WHERE id = ?", [request.sender_id]);
      if (reqSender && reqSender.is_guest === 0) {
        addXp(db, request.sender_id, 25);
      }

      // Notify sender
      const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'friend_accept', 'قبول طلب الصداقة ✨', ?, '/friends')",
        [notifId, request.sender_id, `وافق ${session.username} على طلب الصداقة الخاص بك.`]
      );
      sendToUser(request.sender_id, {
        type: 'notification:new',
        notification: {
          id: notifId,
          title: 'قبول طلب الصداقة ✨',
          body: `وافق ${session.username} على طلب الصداقة الخاص بك.`
        }
      });
    } else {
      db.run("UPDATE friend_requests SET status = 'rejected' WHERE id = ?", [requestId]);
    }

    saveDb();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في معالجة طلب الصداقة' });
  }
});

// Friends List
app.get('/api/friends', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    const sql = `
      SELECT u.id, u.username, u.gender, u.country, u.avatar_url as avatarUrl,
             u.bio, u.level, u.vip_level as vipLevel, f.created_at as friendshipDate
      FROM friendships f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND u.is_banned = 0
      ORDER BY u.username COLLATE NOCASE ASC
    `;

    const friends = queryAll(db, sql, [session.userId]).map(friend => ({
      ...friend,
      isOnline: connectedSockets.has(friend.id)
    }));

    return res.json({ friends });
  } catch (error) {
    console.error('Friends list error:', error);
    return res.status(500).json({ error: 'خطأ أثناء جلب قائمة الأصدقاء' });
  }
});

// Friend Requests List (both received and sent)
app.get('/api/friends/requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    // Received pending requests
    const receivedSql = `
      SELECT fr.id, fr.created_at as createdAt, fr.status,
             u.id as userId, u.username, u.gender, u.country,
             u.avatar_url as avatarUrl, u.bio, u.level, u.vip_level as vipLevel
      FROM friend_requests fr
      JOIN users u ON fr.sender_id = u.id
      WHERE fr.receiver_id = ? AND fr.status = 'pending' AND u.is_banned = 0
      ORDER BY fr.created_at DESC
    `;
    const received = queryAll(db, receivedSql, [session.userId]).map(r => ({
      ...r,
      direction: 'received',
      isOnline: connectedSockets.has(r.userId)
    }));

    // Sent pending requests
    const sentSql = `
      SELECT fr.id, fr.created_at as createdAt, fr.status,
             u.id as userId, u.username, u.gender, u.country,
             u.avatar_url as avatarUrl, u.bio, u.level, u.vip_level as vipLevel
      FROM friend_requests fr
      JOIN users u ON fr.receiver_id = u.id
      WHERE fr.sender_id = ? AND fr.status = 'pending' AND u.is_banned = 0
      ORDER BY fr.created_at DESC
    `;
    const sent = queryAll(db, sentSql, [session.userId]).map(r => ({
      ...r,
      direction: 'sent',
      isOnline: connectedSockets.has(r.userId)
    }));

    return res.json({ received, sent });
  } catch (error) {
    console.error('Friend requests error:', error);
    return res.status(500).json({ error: 'خطأ أثناء جلب طلبات الصداقة' });
  }
});

// Remove Friend
app.delete('/api/friends/:friendId', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const friendId = req.params.friendId;
    const db = await getDb();

    db.run("DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", [
      session.userId, friendId, friendId, session.userId
    ]);

    db.run("DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [
      session.userId, friendId, friendId, session.userId
    ]);

    saveDb();
    return res.json({ success: true, message: 'تم إزالة الصداقة' });
  } catch (error) {
    console.error('Remove friend error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إزالة الصديق' });
  }
});

app.post('/api/friends/:friendId/remove', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const friendId = req.params.friendId;
    const db = await getDb();

    db.run("DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", [
      session.userId, friendId, friendId, session.userId
    ]);

    db.run("DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [
      session.userId, friendId, friendId, session.userId
    ]);

    saveDb();
    return res.json({ success: true, message: 'تم إزالة الصداقة' });
  } catch (error) {
    console.error('Remove friend error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إزالة الصديق' });
  }
});

// Cancel Sent Friend Request
app.post('/api/friends/requests/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const reqId = req.params.id;
    const db = await getDb();

    db.run("DELETE FROM friend_requests WHERE id = ? AND sender_id = ? AND status = 'pending'", [
      reqId, session.userId
    ]);

    saveDb();
    return res.json({ success: true, message: 'تم إلغاء طلب الصداقة' });
  } catch (error) {
    console.error('Cancel friend request error:', error);
    return res.status(500).json({ error: 'خطأ في إلغاء طلب الصداقة' });
  }
});

// Follow / Unfollow
app.post('/api/users/:id/follow', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const targetId = req.params.id;
    const db = await getDb();

    const existing = queryOne(
      db,
      "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
      [session.userId, targetId]
    );

    if (existing) {
      db.run("DELETE FROM follows WHERE id = ?", [existing.id]);
      saveDb();
      return res.json({ success: true, following: false });
    } else {
      const followId = 'flw_' + Math.random().toString(36).substring(2, 9);
      db.run("INSERT INTO follows (id, follower_id, following_id) VALUES (?, ?, ?)", [followId, session.userId, targetId]);
      saveDb();
      return res.json({ success: true, following: true });
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في المتابعة' });
  }
});

// Block User
app.post('/api/users/:id/block', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const targetId = req.params.id;
    if (session.userId === targetId) {
      return res.status(400).json({ error: 'لا يمكنك حظر نفسك' });
    }
    const db = await getDb();

    const existing = queryOne(
      db,
      "SELECT id FROM blocks WHERE user_id = ? AND blocked_user_id = ?",
      [session.userId, targetId]
    );

    if (existing) {
      db.run("DELETE FROM blocks WHERE id = ?", [existing.id]);
      saveDb();
      return res.json({ success: true, blocked: false, message: 'تم إلغاء الحظر بنجاح' });
    } else {
      const blockId = 'blk_' + Math.random().toString(36).substring(2, 9);
      db.run("INSERT INTO blocks (id, user_id, blocked_user_id) VALUES (?, ?, ?)", [blockId, session.userId, targetId]);

      // Complete severing of social ties on block:
      db.run("DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)", [
        session.userId, targetId, targetId, session.userId
      ]);
      db.run("DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)", [
        session.userId, targetId, targetId, session.userId
      ]);
      db.run("DELETE FROM follows WHERE (follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?)", [
        session.userId, targetId, targetId, session.userId
      ]);

      saveDb();

      // Realtime notification to target so active chat/session updates immediately
      sendToUser(targetId, {
        type: 'user:blocked',
        userId: session.userId
      });

      return res.json({ success: true, blocked: true, message: 'تم حظر المستخدم بنجاح' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في حظر المستخدم' });
  }
});

// List Blocked Users
app.get('/api/blocks', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT b.id, b.blocked_user_id as blockedUserId, b.created_at as createdAt,
              u.username as blockedUsername, u.avatar_url as blockedAvatar
       FROM blocks b
       JOIN users u ON b.blocked_user_id = u.id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [session.userId]
    );
    return res.json({ blocks: rows });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب قائمة الحظر' });
  }
});

// Unblock User (by blocked user ID)
app.delete('/api/blocks/:blockedUserId', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { blockedUserId } = req.params;
    const db = await getDb();
    db.run("DELETE FROM blocks WHERE user_id = ? AND blocked_user_id = ?", [session.userId, blockedUserId]);
    saveDb();
    return res.json({ success: true, message: 'تم إلغاء الحظر بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إلغاء الحظر' });
  }
});

// Mute / Unmute User
app.post('/api/users/:id/mute', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const targetId = req.params.id;
    if (session.userId === targetId) {
      return res.status(400).json({ error: 'لا يمكنك كتم نفسك' });
    }
    const db = await getDb();

    const existing = queryOne(
      db,
      "SELECT id FROM mutes WHERE user_id = ? AND muted_user_id = ?",
      [session.userId, targetId]
    );

    if (existing) {
      db.run("DELETE FROM mutes WHERE id = ?", [existing.id]);
      saveDb();
      return res.json({ success: true, muted: false, message: 'تم إلغاء كتم المستخدم' });
    } else {
      const muteId = 'mute_' + Math.random().toString(36).substring(2, 9);
      db.run("INSERT INTO mutes (id, user_id, muted_user_id) VALUES (?, ?, ?)", [muteId, session.userId, targetId]);
      saveDb();
      return res.json({ success: true, muted: true, message: 'تم كتم إشعارات هذا المستخدم' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في كتم المستخدم' });
  }
});

// List Muted Users
app.get('/api/mutes', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT m.id, m.muted_user_id as mutedUserId, m.created_at as createdAt,
              u.username as mutedUsername, u.avatar_url as mutedAvatar
       FROM mutes m
       JOIN users u ON m.muted_user_id = u.id
       WHERE m.user_id = ?
       ORDER BY m.created_at DESC`,
      [session.userId]
    );
    return res.json({ mutes: rows });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب قائمة الكتم' });
  }
});

// Unmute User (by muted user ID)
app.delete('/api/mutes/:mutedUserId', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { mutedUserId } = req.params;
    const db = await getDb();
    db.run("DELETE FROM mutes WHERE user_id = ? AND muted_user_id = ?", [session.userId, mutedUserId]);
    saveDb();
    return res.json({ success: true, message: 'تم إلغاء الكتم بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إلغاء الكتم' });
  }
});

// Report User or Content
app.post('/api/reports', requireAuth, reportRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { targetType, targetId, reportedUserId, category, details, evidenceUrl } = req.body;

    if (!category || !details) {
      return res.status(400).json({ error: 'يرجى توضيح سبب وتفاصيل البلاغ' });
    }

    const db = await getDb();
    const reportId = 'rep_' + Math.random().toString(36).substring(2, 9);

    db.run(
      `INSERT INTO reports (
        id, reporter_id, reported_user_id, target_type, target_id, category, details, evidence_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [reportId, session.userId, reportedUserId || '', targetType || 'user', targetId || '', category, details, evidenceUrl || '']
    );

    saveDb();
    return res.json({ success: true, message: 'تم استلام بلاغك وسيقوم فريق الإدارة بمراجعته بدقة' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إرسال البلاغ' });
  }
});

// ==========================================
// 4. PRIVATE MESSAGING
// ==========================================

// Get conversations list
app.get('/api/conversations', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    const sql = `
      SELECT c.id, c.user1_id, c.user2_id, c.updated_at,
             u.id as other_id, u.username as other_username, u.gender as other_gender,
             u.country as other_country, u.avatar_url as other_avatar, u.vip_level as other_vip,
             MAX(s.is_online) as other_is_online,
             (SELECT content FROM private_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
             (SELECT type FROM private_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_type,
             (SELECT created_at FROM private_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
             (SELECT COUNT(*) FROM private_messages WHERE conversation_id = c.id AND recipient_id = ? AND is_read = 0) as unread_count
      FROM private_conversations c
      JOIN users u ON (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END) = u.id
      LEFT JOIN sessions s ON u.id = s.user_id AND s.expires_at > CURRENT_TIMESTAMP
      WHERE c.user1_id = ? OR c.user2_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `;

    const rows = queryAll(db, sql, [session.userId, session.userId, session.userId, session.userId]);

    const conversations = rows.map(r => ({
      id: r.id,
      recipient: {
        id: r.other_id,
        username: r.other_username,
        gender: r.other_gender,
        country: r.other_country,
        avatarUrl: r.other_avatar,
        vipLevel: r.other_vip,
        isOnline: r.other_is_online === 1 || connectedSockets.has(r.other_id)
      },
      lastMessage: r.last_message_content ? {
        content: r.last_message_content,
        type: r.last_message_type,
        createdAt: r.last_message_time
      } : null,
      unreadCount: r.unread_count || 0,
      updatedAt: r.updated_at
    }));

    return res.json({ conversations });
  } catch (error) {
    console.error('Conversations error:', error);
    return res.status(500).json({ error: 'خطأ في جلب المحادثات' });
  }
});

// Get or Create conversation with user
app.post('/api/conversations/with/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const otherId = req.params.userId;
    if (session.userId === otherId) {
      return res.status(400).json({ error: 'لا يمكن بدء محادثة مع نفسك' });
    }

    const db = await getDb();

    // Check blocks
    const blocked = queryOne(
      db,
      "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
      [session.userId, otherId, otherId, session.userId]
    );
    if (blocked) {
      return res.status(403).json({ error: 'لا يمكن بدء المحادثة نظراً لوجود حظر بين الحسابين' });
    }

    // Check privacy_messages (friends only or closed)
    const recipientUser = queryOne(db, "SELECT privacy_messages FROM users WHERE id = ?", [otherId]);
    if (recipientUser && (recipientUser.privacy_messages === 'nobody' || recipientUser.privacy_messages === 'closed')) {
      return res.status(403).json({ error: 'هذا المستخدم أغلق استقبال الرسائل الخاصة.' });
    }
    if (recipientUser && recipientUser.privacy_messages === 'friends') {
      const isFriend = queryOne(
        db,
        "SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
        [session.userId, otherId, otherId, session.userId]
      );
      if (!isFriend) {
        return res.status(403).json({ error: 'هذا المستخدم يتيح استقبال المحادثات من أصدقائه فقط.' });
      }
    }

    let conv = queryOne(
      db,
      "SELECT id FROM private_conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
      [session.userId, otherId, otherId, session.userId]
    );

    if (!conv) {
      const convId = 'conv_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO private_conversations (id, user1_id, user2_id) VALUES (?, ?, ?)",
        [convId, session.userId, otherId]
      );
      saveDb();
      conv = { id: convId };
    }

    return res.json({ conversationId: conv.id });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في فتح المحادثة' });
  }
});

// Get Messages
app.get('/api/conversations/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const convId = req.params.id;
    const db = await getDb();

    // Check membership
    const conv = queryOne(
      db,
      "SELECT * FROM private_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
      [convId, session.userId, session.userId]
    );
    if (!conv) {
      return res.status(403).json({ error: 'غير مصرح لك بالدخول لهذه المحادثة' });
    }

    // Mark unread messages as read
    db.run(
      "UPDATE private_messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0",
      [convId, session.userId]
    );
    saveDb();

    // Broadcast updated unread count to current user
    const remainingUnread = queryOne(
      db,
      "SELECT COUNT(*) as c FROM private_messages WHERE recipient_id = ? AND is_read = 0",
      [session.userId]
    )?.c || 0;

    sendToUser(session.userId, {
      type: 'unread_count:update',
      unreadMessages: remainingUnread
    });

    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string) || 60));
    const before = req.query.before as string;
    let sql = `SELECT m.*, u.username as sender_username, u.avatar_url as sender_avatar
               FROM private_messages m
               JOIN users u ON m.sender_id = u.id
               WHERE m.conversation_id = ?`;
    const params: any[] = [convId];
    if (before) {
      sql += ` AND m.created_at < ?`;
      params.push(before);
    }
    sql += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const rowsDesc = queryAll(db, sql, params);
    const rows = [...rowsDesc].reverse();

    const otherUserId = conv.user1_id === session.userId ? conv.user2_id : conv.user1_id;
    const otherUser = queryOne(
      db,
      "SELECT id, username, gender, country, avatar_url, vip_level, privacy_online_status FROM users WHERE id = ?",
      [otherUserId]
    );

    const isBlockedByMe = !!queryOne(
      db,
      "SELECT id FROM blocks WHERE user_id = ? AND blocked_user_id = ?",
      [session.userId, otherUserId]
    );
    const isBlockedByThem = !!queryOne(
      db,
      "SELECT id FROM blocks WHERE user_id = ? AND blocked_user_id = ?",
      [otherUserId, session.userId]
    );
    const isMuted = !!queryOne(
      db,
      "SELECT id FROM mutes WHERE user_id = ? AND muted_user_id = ?",
      [session.userId, otherUserId]
    );

    return res.json({
      messages: rows.map(m => {
        const isViewOnce = m.is_view_once === 1;
        const isViewed = m.is_viewed === 1;
        let mediaUrl = m.media_url;
        if (isViewOnce && isViewed) {
          mediaUrl = ''; // Hide permanently once viewed
        }

        return {
          id: m.id,
          senderId: m.sender_id,
          recipientId: m.recipient_id,
          content: m.is_destroyed === 1 ? '⚠️ تم تدمير هذه الصورة ذاتياً' : m.content,
          type: m.type,
          mediaUrl: m.is_destroyed === 1 ? '' : mediaUrl,
          isRead: m.is_read === 1,
          isSelfDestruct: m.is_self_destruct === 1,
          selfDestructDuration: m.self_destruct_duration,
          isDestroyed: m.is_destroyed === 1,
          isViewOnce,
          isViewed,
          viewedAt: m.viewed_at,
          createdAt: m.created_at
        };
      }),
      recipient: {
        ...otherUser,
        isOnline: (otherUser?.privacy_online_status === 'nobody' ? false : isUserOnline(otherUserId)),
        isBlockedByMe,
        isBlockedByThem,
        isMuted
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الرسائل' });
  }
});

// Mark conversation as read explicitly
app.post('/api/conversations/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const convId = req.params.id;
    const db = await getDb();

    db.run(
      "UPDATE private_messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0",
      [convId, session.userId]
    );
    saveDb();

    const remainingUnread = queryOne(
      db,
      "SELECT COUNT(*) as c FROM private_messages WHERE recipient_id = ? AND is_read = 0",
      [session.userId]
    )?.c || 0;

    sendToUser(session.userId, {
      type: 'unread_count:update',
      unreadMessages: remainingUnread
    });

    return res.json({ success: true, unreadMessages: remainingUnread });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Send Private Message
app.post('/api/conversations/:id/messages', requireAuth, messageSendRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const convId = req.params.id;
    const { content, type, mediaUrl, isSelfDestruct, selfDestructDuration, isViewOnce, replyToId } = req.body;

    const db = await getDb();
    const conv = queryOne(
      db,
      "SELECT * FROM private_conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
      [convId, session.userId, session.userId]
    );
    if (!conv) {
      return res.status(403).json({ error: 'غير مصرح لك بالإرسال في هذه المحادثة' });
    }

    const recipientId = conv.user1_id === session.userId ? conv.user2_id : conv.user1_id;

    // 1. BLOCK ENFORCEMENT (Server-side):
    const isBlocked = queryOne(
      db,
      "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
      [session.userId, recipientId, recipientId, session.userId]
    );
    if (isBlocked) {
      return res.status(403).json({ error: 'لا يمكن إرسال الرسالة نظراً لوجود حظر بين الحسابين.' });
    }

    // 2. PRIVACY ENFORCEMENT (Server-side):
    const recipientUser = queryOne(db, "SELECT privacy_messages FROM users WHERE id = ?", [recipientId]);
    if (recipientUser && (recipientUser.privacy_messages === 'nobody' || recipientUser.privacy_messages === 'closed')) {
      return res.status(403).json({ error: 'هذا المستخدم أغلق استقبال الرسائل الخاصة.' });
    }
    if (recipientUser && recipientUser.privacy_messages === 'friends') {
      const isFriend = queryOne(
        db,
        "SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
        [session.userId, recipientId, recipientId, session.userId]
      );
      if (!isFriend) {
        return res.status(403).json({ error: 'هذا المستخدم يتيح استقبال الرسائل من أصدقائه فقط.' });
      }
    }

    // 3. ANTI-SPAM / PROFANITY / SUSPICIOUS LINKS FILTER (Server-side):
    if (content) {
      const modCheck = checkMessageContent(session.userId, content, db);
      if (!modCheck.allowed) {
        return res.status(400).json({ error: modCheck.reason });
      }
    }

    // 4. EMAIL VERIFICATION ENFORCEMENT (Server-side):
    if (!session.isGuest && !session.emailVerified) {
      return res.status(403).json({
        error: 'يرجى تأكيد بريدك الإلكتروني أولاً لتفعيل إمكانية إرسال الرسائل وتأمين حسابك بالكامل.',
        requireEmailVerification: true,
        email: session.email
      });
    }

    // 5. GUEST RESTRICTION ENFORCEMENT:
    if (session.isGuest) {
      const guestCheck = queryOne(db, "SELECT guest_messages_remaining FROM users WHERE id = ?", [session.userId]);
      if (!guestCheck || guestCheck.guest_messages_remaining <= 0) {
        return res.status(403).json({
          error: 'لقد استنفدت الحد المسموح به لرسائل الزوار (500 رسالة). يرجى إنشاء حساب مجاني للاستمرار في المحادثة دون قيود!'
        });
      }
      db.run("UPDATE users SET guest_messages_remaining = guest_messages_remaining - 1 WHERE id = ?", [session.userId]);
    }

    const msgId = 'msg_' + Math.random().toString(36).substring(2, 9);
    const msgType = type || 'text';
    const viewOnceToken = isViewOnce ? Math.random().toString(36).substring(2, 15) : '';

    db.run(
      `INSERT INTO private_messages (
        id, conversation_id, sender_id, recipient_id, content, type,
        reply_to_id, is_self_destruct, self_destruct_duration, media_url,
        is_view_once, is_viewed, view_once_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        msgId,
        convId,
        session.userId,
        recipientId,
        content || '',
        msgType,
        replyToId || null,
        isSelfDestruct ? 1 : 0,
        selfDestructDuration || 0,
        mediaUrl || '',
        isViewOnce ? 1 : 0,
        viewOnceToken
      ]
    );

    // Update conversation timestamp
    db.run("UPDATE private_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [convId]);

    // Gamification & Mission progress (only for non-guests)
    if (!session.isGuest) {
      addXp(db, session.userId, 5);
      trackMissionAction(db, session.userId, 'message', 1);
    }

    saveDb();

    const messageObj = {
      type: 'message:new',
      message: {
        id: msgId,
        conversationId: convId,
        senderId: session.userId,
        recipientId,
        content,
        type: msgType,
        mediaUrl,
        isSelfDestruct: !!isSelfDestruct,
        selfDestructDuration: selfDestructDuration || 0,
        isDestroyed: false,
        isViewOnce: !!isViewOnce,
        isViewed: false,
        isRead: false,
        createdAt: new Date().toISOString()
      }
    };

    // 6. MUTE CHECK: Check if recipient muted sender
    const isMuted = queryOne(
      db,
      "SELECT id FROM mutes WHERE user_id = ? AND muted_user_id = ?",
      [recipientId, session.userId]
    );

    // Fetch sender profile details and updated unread count for notifications
    const senderUser = queryOne(db, "SELECT username, avatar_url, role FROM users WHERE id = ?", [session.userId]);
    const unreadCount = queryOne(
      db,
      "SELECT COUNT(*) as c FROM private_messages WHERE recipient_id = ? AND is_read = 0",
      [recipientId]
    )?.c || 1;

    // Send real-time message to recipient
    sendToUser(recipientId, {
      ...messageObj,
      silent: !!isMuted
    });

    // Send new_private_message dedicated event for instant notification toasts
    sendToUser(recipientId, {
      type: 'new_private_message',
      messageId: msgId,
      conversationId: convId,
      senderId: session.userId,
      senderUsername: senderUser?.username || session.username,
      senderAvatar: senderUser?.avatar_url || '',
      senderRole: senderUser?.role || session.role || 'user',
      preview: msgType === 'image' ? '📷 أرسل لك صورة' : (msgType === 'audio' ? '🎤 أرسل تسجيلاً صوتياً' : (content || '').slice(0, 80)),
      msgType: msgType,
      createdAt: new Date().toISOString(),
      unreadCount,
      silent: !!isMuted
    });

    // Broadcast updated unread count to recipient
    sendToUser(recipientId, {
      type: 'unread_count:update',
      unreadMessages: unreadCount
    });

    if (!isMuted) {
      // Send live toast alert to recipient (backward compatible)
      sendToUser(recipientId, {
        type: 'toast:new',
        toast: {
          id: 'tst_' + Date.now(),
          type: 'message',
          title: session.username,
          body: msgType === 'image' ? '📷 أرسل لك صورة' : (msgType === 'audio' ? '🎤 أرسل تسجيلاً صوتياً' : (content || '').slice(0, 60)),
          senderId: session.userId,
          avatarUrl: senderUser?.avatar_url || ''
        }
      });
    }

    return res.json({ success: true, message: messageObj.message });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'خطأ في إرسال الرسالة' });
  }
});

// Open View-Once Media (WhatsApp-like Single View Authorization)
app.post('/api/messages/:id/view-once', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const msgId = req.params.id;
    const db = await getDb();

    const msg = queryOne(
      db,
      "SELECT * FROM private_messages WHERE id = ?",
      [msgId]
    );

    if (!msg || msg.is_view_once !== 1) {
      return res.status(404).json({ error: 'الوسائط غير موجودة أو ليست مخصصة للعرض مرة واحدة' });
    }

    // Only the recipient can view the view-once media
    if (msg.recipient_id !== session.userId) {
      return res.status(403).json({ error: 'غير مصرح لك بفتح هذه الوسائط. مخصصة للمستلم فقط.' });
    }

    // If already viewed, strictly refuse to show it again
    if (msg.is_viewed === 1) {
      return res.status(410).json({ error: 'تم فتح هذه الوسائط مسبقاً ولم تعد متاحة للعرض' });
    }

    // Mark as viewed in DB immediately
    db.run(
      "UPDATE private_messages SET is_viewed = 1, viewed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [msgId]
    );
    saveDb();

    // Notify sender in real-time
    sendToUser(msg.sender_id, {
      type: 'message:view_once_opened',
      messageId: msgId,
      conversationId: msg.conversation_id,
      viewedAt: new Date().toISOString()
    });

    // Schedule server-side destruction after viewing window (60s grace period)
    setTimeout(async () => {
      try {
        const freshDb = await getDb();
        const currentMsg = queryOne(freshDb, "SELECT media_url FROM private_messages WHERE id = ?", [msgId]);
        if (currentMsg && currentMsg.media_url && currentMsg.media_url.startsWith('/uploads/')) {
          const fn = path.basename(currentMsg.media_url);
          const fp = path.join(UPLOAD_DIR, fn);
          if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch {}
          }
        }
        freshDb.run(
          "UPDATE private_messages SET media_url = '', content = '⚠️ تم فتح الصورة لمرة واحدة ومسحها نهائياً' WHERE id = ?",
          [msgId]
        );
        saveDb();
      } catch (err) {}
    }, 60 * 1000);

    return res.json({
      success: true,
      mediaUrl: msg.media_url,
      type: msg.type
    });
  } catch (error) {
    console.error('View once error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء فتح الوسائط' });
  }
});

// Explicit Close for View-Once: Immediate file erase
app.post('/api/messages/:id/view-once-close', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const msgId = req.params.id;
    const db = await getDb();

    const msg = queryOne(db, "SELECT * FROM private_messages WHERE id = ? AND recipient_id = ?", [msgId, session.userId]);
    if (msg && msg.media_url && msg.media_url.startsWith('/uploads/')) {
      const fn = path.basename(msg.media_url);
      const fp = path.join(UPLOAD_DIR, fn);
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch {}
      }
      db.run("UPDATE private_messages SET media_url = '', content = '⚠️ تم فتح الصورة لمرة واحدة ومسحها نهائياً' WHERE id = ?", [msgId]);
      saveDb();
    }
    return res.json({ success: true });
  } catch (e) {
    return res.json({ success: true });
  }
});

// Self-Destruct Trigger Endpoint (Server-Side Enforced!)
app.post('/api/messages/:id/view-self-destruct', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const msgId = req.params.id;
    const db = await getDb();

    const msg = queryOne(
      db,
      "SELECT * FROM private_messages WHERE id = ? AND (sender_id = ? OR recipient_id = ?)",
      [msgId, session.userId, session.userId]
    );

    if (!msg || msg.is_self_destruct !== 1) {
      return res.status(404).json({ error: 'الرسالة غير صالحة' });
    }

    if (msg.is_destroyed === 1) {
      return res.status(410).json({ error: 'تم تدمير هذه الصورة بالفعل' });
    }

    const duration = msg.self_destruct_duration || 10; // seconds

    // Schedule server-side destruction
    setTimeout(async () => {
      try {
        const freshDb = await getDb();
        const currentMsg = queryOne(freshDb, "SELECT media_url FROM private_messages WHERE id = ?", [msgId]);
        if (currentMsg && currentMsg.media_url && currentMsg.media_url.startsWith('/uploads/')) {
          const fn = path.basename(currentMsg.media_url);
          const fp = path.join(UPLOAD_DIR, fn);
          if (fs.existsSync(fp)) {
            try { fs.unlinkSync(fp); } catch {}
          }
        }

        freshDb.run(
          "UPDATE private_messages SET is_destroyed = 1, media_url = '', content = '⚠️ تم تدمير الصورة ذاتياً', destroyed_at = CURRENT_TIMESTAMP WHERE id = ?",
          [msgId]
        );
        saveDb();

        const destroyedEvent = {
          type: 'message:destroyed',
          messageId: msgId,
          conversationId: msg.conversation_id
        };
        sendToUser(msg.sender_id, destroyedEvent);
        sendToUser(msg.recipient_id, destroyedEvent);
      } catch (e) {
        console.error('Destroy error:', e);
      }
    }, duration * 1000);

    return res.json({
      success: true,
      duration,
      mediaUrl: msg.media_url
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في معالجة تدمير الصورة' });
  }
});

// ==========================================
// 5. CHAT ROOMS ("الغرف والمجالس")
// ==========================================
// IMPORTANT: Completely separate from Online Users.
// Starts with 0 rooms (NO demo rooms).
// Owner/Admin creates real rooms.

app.get('/api/rooms', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = queryAll(
      db,
      `SELECT r.*, u.username as creator_username,
              (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
       FROM rooms r
       JOIN users u ON r.created_by = u.id
       ORDER BY r.created_at DESC`
    );

    return res.json({ rooms: rows });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب قائمة الغرف والمجالس' });
  }
});

// Create Room (Owner / Admin Only)
app.post('/api/rooms', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;

    // Check authorization: Owner or Admin
    if (session.role !== 'owner' && session.role !== 'admin') {
      return res.status(403).json({
        error: 'صلاحية إنشاء الغرف والمجالس محصورة لمالك المنصة والإدارة فقط.'
      });
    }

    if (!session.isGuest && !session.emailVerified) {
      return res.status(403).json({
        error: 'يرجى تأكيد بريدك الإلكتروني أولاً لتفعيل صلاحية إنشاء الغرف والمجالس.',
        requireEmailVerification: true,
        email: session.email
      });
    }

    const { name, description, category, isPrivate, password, rules, imageUrl } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'يرجى إدخال اسم المجلس والتصنيف' });
    }

    const db = await getDb();
    const roomId = 'room_' + Math.random().toString(36).substring(2, 9);

    db.run(
      `INSERT INTO rooms (
        id, name, description, category, is_private, password_hash, rules, image_url, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        roomId,
        name.trim(),
        description || '',
        category,
        isPrivate ? 1 : 0,
        password ? hashPassword(password).hash : '',
        rules || '',
        imageUrl || '',
        session.userId
      ]
    );

    // Add creator as room owner
    const memberId = 'rm_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO room_members (id, room_id, user_id, role) VALUES (?, ?, ?, 'owner')",
      [memberId, roomId, session.userId]
    );

    saveDb();
    return res.json({ success: true, roomId, message: 'تم إنشاء المجلس الحواري بنجاح' });
  } catch (error) {
    console.error('Create room error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إنشاء الغرفة' });
  }
});

// Join Room
app.post('/api/rooms/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const roomId = req.params.id;
    const db = await getDb();

    const room = queryOne(db, "SELECT * FROM rooms WHERE id = ?", [roomId]);
    if (!room) {
      return res.status(404).json({ error: 'المجلس غير موجود' });
    }

    const existing = queryOne(db, "SELECT * FROM room_members WHERE room_id = ? AND user_id = ?", [roomId, session.userId]);
    if (!existing) {
      const memberId = 'rm_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO room_members (id, room_id, user_id, role) VALUES (?, ?, ?, 'member')",
        [memberId, roomId, session.userId]
      );
      saveDb();
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في الانضمام للمجلس' });
  }
});

// Get Room Messages
app.get('/api/rooms/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const roomId = req.params.id;
    const db = await getDb();

    const room = queryOne(db, "SELECT * FROM rooms WHERE id = ?", [roomId]);
    if (!room) {
      return res.status(404).json({ error: 'المجلس غير موجود' });
    }

    const rows = queryAll(
      db,
      `SELECT m.*, u.username as sender_username, u.role as sender_role, u.gender as sender_gender,
              u.avatar_url as sender_avatar, u.vip_level as sender_vip
       FROM room_messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.room_id = ?
       ORDER BY m.created_at ASC LIMIT 100`,
      [roomId]
    );

    const members = queryAll(
      db,
      `SELECT rm.role as room_role, u.id, u.username, u.role, u.gender, u.avatar_url, u.vip_level
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = ?`,
      [roomId]
    );

    return res.json({
      room,
      messages: rows,
      members: members.map(m => ({
        ...m,
        isOnline: connectedSockets.has(m.id)
      }))
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب رسائل المجلس' });
  }
});

// Post Room Message
app.post('/api/rooms/:id/messages', requireAuth, messageSendRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const roomId = req.params.id;
    const { content, type, mediaUrl } = req.body;

    const db = await getDb();

    // Check mute status in room or global
    const member = queryOne(db, "SELECT is_muted FROM room_members WHERE room_id = ? AND user_id = ?", [roomId, session.userId]);
    if (member?.is_muted === 1) {
      return res.status(403).json({ error: 'تم كتمك في هذا المجلس من قبل المشرفين.' });
    }
    const userGlobal = queryOne(db, "SELECT is_muted FROM users WHERE id = ?", [session.userId]);
    if (userGlobal?.is_muted === 1) {
      return res.status(403).json({ error: 'حسابك مكتوم حالياً من قبل الإدارة.' });
    }

    // Content moderation
    if (content) {
      const modCheck = checkMessageContent(session.userId, content, db);
      if (!modCheck.allowed) {
        return res.status(400).json({ error: modCheck.reason });
      }
    }

    // Check guest limits
    if (session.isGuest) {
      const guestCheck = queryOne(db, "SELECT guest_messages_remaining FROM users WHERE id = ?", [session.userId]);
      if (!guestCheck || guestCheck.guest_messages_remaining <= 0) {
        return res.status(403).json({
          error: 'لقد استنفدت رصيد رسائل الزوار (500 رسالة). أنشئ حساباً مجانياً للاستمرار!'
        });
      }
      db.run("UPDATE users SET guest_messages_remaining = guest_messages_remaining - 1 WHERE id = ?", [session.userId]);
    }

    const msgId = 'rmsg_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO room_messages (id, room_id, sender_id, content, type, media_url) VALUES (?, ?, ?, ?, ?, ?)",
      [msgId, roomId, session.userId, content, type || 'text', mediaUrl || '']
    );

    addXp(db, session.userId, 6);
    trackMissionAction(db, session.userId, 'room_chat', 1);
    saveDb();

    const messagePayload = {
      type: 'room:message',
      roomId,
      message: {
        id: msgId,
        roomId,
        senderId: session.userId,
        senderUsername: session.username,
        senderRole: session.role,
        senderGender: session.gender,
        content,
        type: type || 'text',
        mediaUrl,
        createdAt: new Date().toISOString()
      }
    };

    broadcastToRoom(db, roomId, messagePayload);

    return res.json({ success: true, message: messagePayload.message });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إرسال الرسالة للمجلس' });
  }
});

// ==========================================
// 6. STORIES (24-Hour Expiration)
// ==========================================

app.get('/api/stories', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    // Expiration enforced server-side: expires_at > CURRENT_TIMESTAMP
    // Also exclude stories from blocked users (bidirectional)
    const rows = queryAll(
      db,
      `SELECT s.*, u.username, u.avatar_url, u.gender, u.privacy_story_visibility,
              (SELECT COUNT(*) FROM story_views WHERE story_id = s.id) as view_count
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.expires_at > CURRENT_TIMESTAMP
         AND s.user_id NOT IN (SELECT blocked_user_id FROM blocks WHERE user_id = ?)
         AND s.user_id NOT IN (SELECT user_id FROM blocks WHERE blocked_user_id = ?)
       ORDER BY s.created_at DESC`,
      [session.userId, session.userId]
    );

    // Filter stories that are set to friends-only
    const visibleStories = rows.filter(story => {
      if (story.user_id === session.userId) return true;
      if (story.privacy_story_visibility === 'friends') {
        const isFriend = queryOne(
          db,
          "SELECT id FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
          [session.userId, story.user_id, story.user_id, session.userId]
        );
        return !!isFriend;
      }
      return true;
    });

    return res.json({ stories: visibleStories });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب القصص' });
  }
});

app.post('/api/stories', requireAuth, storyRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;

    if (!session.isGuest && !session.emailVerified) {
      return res.status(403).json({
        error: 'يرجى تأكيد بريدك الإلكتروني أولاً لتتمكن من نشر القصص.',
        requireEmailVerification: true,
        email: session.email
      });
    }

    const { content, mediaUrl, type } = req.body;

    if (!content && !mediaUrl) {
      return res.status(400).json({ error: 'يرجى كتابة نص أو إرفاق صورة للقصة' });
    }

    const db = await getDb();
    const storyId = 'story_' + Math.random().toString(36).substring(2, 9);
    // Exactly 24 hours expiry
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.run(
      "INSERT INTO stories (id, user_id, content, media_url, type, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      [storyId, session.userId, content || '', mediaUrl || '', type || 'text', expiresAt]
    );

    addXp(db, session.userId, 20);
    trackMissionAction(db, session.userId, 'story', 1);
    saveDb();

    return res.json({ success: true, storyId, message: 'تم نشر قصتك بنجاح لمدة 24 ساعة' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في نشر القصة' });
  }
});

app.post('/api/stories/:id/view', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const storyId = req.params.id;
    const db = await getDb();

    const viewId = 'view_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT OR IGNORE INTO story_views (id, story_id, viewer_id) VALUES (?, ?, ?)",
      [viewId, storyId, session.userId]
    );
    saveDb();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في تسجيل المشاهدة' });
  }
});

app.delete('/api/stories/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const storyId = req.params.id;
    const db = await getDb();

    db.run("DELETE FROM stories WHERE id = ? AND user_id = ?", [storyId, session.userId]);
    saveDb();
    return res.json({ success: true, message: 'تم حذف القصة بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في حذف القصة' });
  }
});

// ==========================================
// 7. MISSIONS, ACHIEVEMENTS & GAMIFICATION
// ==========================================

app.get('/api/missions', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const todayKey = new Date().toISOString().slice(0, 10);

    const missions = queryAll(db, "SELECT * FROM missions ORDER BY xp_reward ASC");
    const progress = queryAll(
      db,
      "SELECT * FROM user_mission_progress WHERE user_id = ? AND date_key = ?",
      [session.userId, todayKey]
    );

    const progMap = new Map(progress.map(p => [p.mission_id, p]));

    const result = missions.map(m => {
      const p = progMap.get(m.id);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        category: m.category,
        xpReward: m.xp_reward,
        coinsReward: m.coins_reward,
        targetCount: m.target_count,
        currentCount: p ? p.current_count : 0,
        isCompleted: p ? (p.is_completed === 1 || p.current_count >= m.target_count) : false,
        isClaimed: p ? p.is_claimed === 1 : false
      };
    });

    return res.json({ missions: result });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب المهام' });
  }
});

app.post('/api/missions/:id/claim', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'مكافآت المهام اليومية مخصصة للحسابات المسجلة فقط. يرجى إنشاء حساب مجاني!' });
    }
    const missionId = req.params.id;
    const db = await getDb();
    const todayKey = new Date().toISOString().slice(0, 10);

    const mission = queryOne(db, "SELECT * FROM missions WHERE id = ?", [missionId]);
    if (!mission) {
      return res.status(404).json({ error: 'المهمة غير موجودة' });
    }

    const prog = queryOne(
      db,
      "SELECT * FROM user_mission_progress WHERE user_id = ? AND mission_id = ? AND date_key = ?",
      [session.userId, missionId, todayKey]
    );

    if (!prog || prog.current_count < mission.target_count) {
      return res.status(400).json({ error: 'لم تكتمل متطلبات المهمة بعد' });
    }

    if (prog.is_claimed === 1) {
      return res.status(400).json({ error: 'تم استلام هذه المكافأة مسبقاً' });
    }

    db.run("UPDATE user_mission_progress SET is_claimed = 1 WHERE id = ?", [prog.id]);

    // Add Coins & XP
    db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [mission.coins_reward, session.userId]);
    addXp(db, session.userId, mission.xp_reward);

    // Record wallet tx
    const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'mission_reward', ?)",
      [txId, session.userId, mission.coins_reward, `مكافأة إتمام مهمة: ${mission.title}`]
    );

    saveDb();
    return res.json({
      success: true,
      coinsReward: mission.coins_reward,
      xpReward: mission.xp_reward,
      message: `تم استلام ${mission.coins_reward} كوينز و ${mission.xp_reward} نقطة خبرة!`
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في استلام المكافأة' });
  }
});

// OWNER MISSION MANAGEMENT (Owner Only)
// 1. Create Mission
app.post(['/api/admin/missions', '/api/missions'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { title, description, category, actionType, targetCount, xpReward, coinsReward, isActive } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'العنوان والوصف مطلوبان' });
    }

    const db = await getDb();
    const id = `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    db.run(
      `INSERT INTO missions (id, title, description, category, action_type, target_count, xp_reward, coins_reward, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title.trim(),
        description.trim(),
        category || 'daily',
        actionType || 'message',
        Number(targetCount) || 1,
        Number(xpReward) || 20,
        Number(coinsReward) || 15,
        isActive !== undefined ? (isActive ? 1 : 0) : 1
      ]
    );

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'create_mission', 'mission', ?, ?)`,
      [logId, session.userId, id, `تم إنشاء مهمة يومية جديدة: ${title.trim()}`]
    );

    saveDb();
    return res.json({ success: true, missionId: id, message: 'تم إنشاء المهمة بنجاح' });
  } catch (error) {
    console.error('Create mission error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إنشاء المهمة' });
  }
});

// 2. Update Mission
app.put(['/api/admin/missions/:id', '/api/missions/:id'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const missionId = req.params.id;
    const { title, description, category, actionType, targetCount, xpReward, coinsReward, isActive } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'العنوان والوصف مطلوبان' });
    }

    const db = await getDb();
    const existing = queryOne(db, "SELECT id, title FROM missions WHERE id = ?", [missionId]);
    if (!existing) {
      return res.status(404).json({ error: 'المهمة غير موجودة' });
    }

    db.run(
      `UPDATE missions SET
         title = ?,
         description = ?,
         category = ?,
         action_type = ?,
         target_count = ?,
         xp_reward = ?,
         coins_reward = ?,
         is_active = ?
       WHERE id = ?`,
      [
        title.trim(),
        description.trim(),
        category || 'daily',
        actionType || 'message',
        Number(targetCount) || 1,
        Number(xpReward) || 20,
        Number(coinsReward) || 15,
        isActive !== undefined ? (isActive ? 1 : 0) : 1,
        missionId
      ]
    );

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'update_mission', 'mission', ?, ?)`,
      [logId, session.userId, missionId, `تم تعديل المهمة: ${title.trim()}`]
    );

    saveDb();
    return res.json({ success: true, message: 'تم تحديث المهمة بنجاح' });
  } catch (error) {
    console.error('Update mission error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تحديث المهمة' });
  }
});

// 3. Delete Mission
app.delete(['/api/admin/missions/:id', '/api/missions/:id'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const missionId = req.params.id;
    const db = await getDb();

    const existing = queryOne(db, "SELECT id, title FROM missions WHERE id = ?", [missionId]);
    if (!existing) {
      return res.status(404).json({ error: 'المهمة غير موجودة' });
    }

    db.run("DELETE FROM missions WHERE id = ?", [missionId]);

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'delete_mission', 'mission', ?, ?)`,
      [logId, session.userId, missionId, `تم حذف المهمة: ${existing.title}`]
    );

    saveDb();
    return res.json({ success: true, message: 'تم حذف المهمة بنجاح' });
  } catch (error) {
    console.error('Delete mission error:', error);
    return res.status(500).json({ error: 'خطأ أثناء حذف المهمة' });
  }
});

app.get('/api/achievements', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    const all = queryAll(db, "SELECT * FROM achievements ORDER BY xp_reward ASC");
    const unlocked = queryAll(db, "SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?", [session.userId]);
    const unlockedMap = new Map(unlocked.map(u => [u.achievement_id, u.unlocked_at]));

    const result = all.map(a => ({
      ...a,
      isUnlocked: unlockedMap.has(a.id),
      unlockedAt: unlockedMap.get(a.id) || null
    }));

    return res.json({ achievements: result });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الإنجازات' });
  }
});

app.get('/api/leaderboards', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = await getDb();

    const xpLeaders = queryAll(
      db,
      "SELECT id, username, role, gender, country, avatar_url, level, xp, vip_level FROM users WHERE is_banned = 0 ORDER BY xp DESC LIMIT 20"
    );

    const streakLeaders = queryAll(
      db,
      "SELECT id, username, role, gender, country, avatar_url, streak, vip_level FROM users WHERE is_banned = 0 ORDER BY streak DESC LIMIT 20"
    );

    return res.json({ xpLeaders, streakLeaders });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب قوائم المتصدرين' });
  }
});

// ==========================================
// 8. WALLET, GIFTS, VIP & GAMES
// ==========================================

app.get('/api/wallet', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.json({
        balance: 0,
        vipLevel: 'none',
        vipExpiresAt: null,
        transactions: [],
        isGuest: true
      });
    }
    const db = await getDb();

    const user = queryOne(db, "SELECT coins, vip_level, vip_expires_at FROM users WHERE id = ?", [session.userId]);
    const transactions = queryAll(
      db,
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [session.userId]
    );

    return res.json({
      balance: user?.coins || 0,
      vipLevel: user?.vip_level || 'none',
      vipExpiresAt: user?.vip_expires_at,
      transactions
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب بيانات المحفظة' });
  }
});

app.get('/api/gifts', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const gifts = queryAll(db, "SELECT * FROM gifts ORDER BY price_coins ASC");
    return res.json({ gifts });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الهدايا' });
  }
});

// Send Gift
app.post('/api/gifts/send', requireAuth, giftRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'إرسال الهدايا متاح للأعضاء المسجلين فقط.' });
    }
    const { receiverId, giftId, roomId } = req.body;

    if (!receiverId || !giftId) {
      return res.status(400).json({ error: 'يرجى اختيار المستلم والهدية' });
    }

    const db = await getDb();

    // Block check (bidirectional)
    const isBlocked = queryOne(
      db,
      "SELECT id FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
      [session.userId, receiverId, receiverId, session.userId]
    );
    if (isBlocked) {
      return res.status(403).json({ error: 'لا يمكن إرسال هدية لهذا الحساب نظراً لوجود حظر بين الحسابين.' });
    }

    const gift = queryOne(db, "SELECT * FROM gifts WHERE id = ?", [giftId]);
    if (!gift) {
      return res.status(404).json({ error: 'الهدية غير صالحة' });
    }

    const sender = queryOne(db, "SELECT coins FROM users WHERE id = ?", [session.userId]);
    if (!sender || sender.coins < gift.price_coins) {
      return res.status(400).json({ error: `رصيدك من الكوينز غير كافٍ. سعر الهدية: ${gift.price_coins} كوينز` });
    }

    const tx1 = 'tx_' + Math.random().toString(36).substring(2, 9);
    const tx2 = 'tx_' + Math.random().toString(36).substring(2, 9);
    const gtxId = 'gtx_' + Math.random().toString(36).substring(2, 9);
    const receiverGain = Math.floor(gift.price_coins * 0.5);

    db.run("BEGIN TRANSACTION");
    try {
      // Deduct from sender
      db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [gift.price_coins, session.userId]);

      // Send part to receiver (50% value converted to coins)
      db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [receiverGain, receiverId]);

      // Log transactions
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description, related_user_id) VALUES (?, ?, ?, 'gift_sent', ?, ?)",
        [tx1, session.userId, -gift.price_coins, `إرسال هدية (${gift.arabic_name})`, receiverId]
      );
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description, related_user_id) VALUES (?, ?, ?, 'gift_received', ?, ?)",
        [tx2, receiverId, receiverGain, `استلام هدية (${gift.arabic_name}) من ${session.username}`, session.userId]
      );

      // Save gift transaction
      db.run(
        "INSERT INTO gift_transactions (id, sender_id, receiver_id, gift_id, room_id) VALUES (?, ?, ?, ?, ?)",
        [gtxId, session.userId, receiverId, giftId, roomId || null]
      );

      // Award XP
      addXp(db, session.userId, Math.floor(gift.price_coins * 0.8));
      trackMissionAction(db, session.userId, 'gift', 1);

      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    // Notify receiver
    const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'gift_received', 'هدية رائعة جديدة! 🎁', ?, '/wallet')",
      [notifId, receiverId, `أرسل لك ${session.username} هدية فاخرة (${gift.arabic_name} ${gift.icon}).`]
    );

    sendToUser(receiverId, {
      type: 'gift:received',
      gift: {
        id: gift.id,
        arabicName: gift.arabic_name,
        icon: gift.icon,
        animation: gift.animation,
        senderUsername: session.username
      }
    });

    saveDb();
    return res.json({
      success: true,
      message: `تم إرسال ${gift.arabic_name} بنجاح!`,
      newBalance: sender.coins - gift.price_coins
    });
  } catch (error) {
    console.error('Send gift error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إرسال الهدية' });
  }
});

// VIP Membership Plans List (Dynamic from database)
app.get('/api/vip/plans', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = queryAll(db, "SELECT * FROM vip_plans WHERE is_active = 1 ORDER BY display_order ASC, price_coins ASC");
    const plans = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      badge: r.badge,
      color: r.color,
      border: r.border,
      text: r.text_color,
      priceCoins: r.price_coins,
      days: r.days,
      popular: r.popular === 1,
      isActive: r.is_active === 1,
      perks: (() => {
        try { return JSON.parse(r.perks_json || '[]'); } catch { return []; }
      })()
    }));
    return res.json({ plans });
  } catch (error) {
    console.error('Fetch vip plans error:', error);
    return res.status(500).json({ error: 'خطأ في جلب باقات VIP' });
  }
});

// VIP Membership Upgrade or Renewal
app.post('/api/vip/purchase', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'عضويات وميزات VIP مخصصة للحسابات المسجلة فقط. يرجى إنشاء حساب مجاني!' });
    }
    const { tier } = req.body; // 'bronze', 'silver', 'gold', 'royal' or custom

    const db = await getDb();
    const plan = queryOne(db, "SELECT * FROM vip_plans WHERE id = ? AND is_active = 1", [tier]);
    if (!plan) {
      return res.status(400).json({ error: 'باقة VIP المطلوبة غير متاحة حالياً' });
    }

    const user = queryOne(db, "SELECT coins, vip_level, vip_expires_at FROM users WHERE id = ?", [session.userId]);
    if (!user || user.coins < plan.price_coins) {
      return res.status(400).json({ error: `رصيد الكوينز غير كافٍ. التكلفة: ${plan.price_coins} كوينز (رصيدك: ${user?.coins || 0})` });
    }

    // If already active on this tier, extend expiration date; otherwise start from now
    let baseTime = Date.now();
    if (user.vip_level === tier && user.vip_expires_at) {
      const existingExp = new Date(user.vip_expires_at).getTime();
      if (existingExp > baseTime) {
        baseTime = existingExp;
      }
    }

    const expiresAt = new Date(baseTime + plan.days * 24 * 60 * 60 * 1000).toISOString();
    const remainingCoins = user.coins - plan.price_coins;
    const txId = 'tx_' + Math.random().toString(36).substring(2, 9);

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        "UPDATE users SET coins = coins - ?, vip_level = ?, vip_expires_at = ? WHERE id = ?",
        [plan.price_coins, tier, expiresAt, session.userId]
      );

      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'vip_purchase', ?)",
        [txId, session.userId, -plan.price_coins, `ترقية / تجديد اشتراك ${plan.name}`]
      );

      addXp(db, session.userId, 200);
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    broadcastOnlineStatus(session.userId, isUserOnline(session.userId));

    return res.json({
      success: true,
      vipLevel: tier,
      vipExpiresAt: expiresAt,
      coins: remainingCoins,
      message: `مبروك! تم تفعيل اشتراك ${plan.name} بنجاح!`
    });
  } catch (error) {
    console.error('VIP purchase error:', error);
    return res.status(500).json({ error: 'خطأ في ترقية VIP' });
  }
});

// Games: Entry fee (Coin Deduction for games like Tic-Tac-Toe, Quiz, Wheel)
app.post('/api/games/entry', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { game, stake } = req.body;
    const cost = Math.max(1, Number(stake) || 20);

    const db = await getDb();
    const userRow = queryOne(db, "SELECT coins FROM users WHERE id = ?", [session.userId]);
    if (!userRow || userRow.coins < cost) {
      return res.status(400).json({ error: `رصيد الكوينز غير كافٍ. تحتاج إلى ${cost} كوينز للمشاركة.` });
    }

    db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [cost, session.userId]);
    const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
    const gameLabel = game === 'tictactoe' ? 'X & O (تيك تاك تو)' : game === 'quiz' ? 'مسابقة الأمثال' : 'لعبة ترفيهية';
    db.run(
      "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'game_entry', ?)",
      [txId, session.userId, -cost, `رسوم مشاركة في لعبة ${gameLabel}`]
    );
    saveDb();

    return res.json({ success: true, remainingCoins: userRow.coins - cost });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في خصم رسوم اللعبة' });
  }
});

// Games: Winning Reward (Coin Addition)
app.post('/api/games/win', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { game, amount } = req.body;
    const reward = Math.max(1, Math.min(1000, Number(amount) || 40));

    const db = await getDb();
    db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [reward, session.userId]);
    addXp(db, session.userId, Math.round(reward / 2));
    trackMissionAction(db, session.userId, 'game', 1);

    const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
    const gameLabel = game === 'tictactoe' ? 'الفوز في لعبة X & O' : 'الفوز في اللعبة';
    db.run(
      "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'game_win', ?)",
      [txId, session.userId, reward, `جائزة ${gameLabel}`]
    );
    saveDb();

    return res.json({ success: true, reward });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في إضافة جائزة الفوز' });
  }
});

// Games: Spin Wheel (Cost in coins and win prizes)
app.post('/api/games/spin-wheel', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const cost = Math.max(1, Number(req.body.cost) || 20);

    const db = await getDb();
    const userRow = queryOne(db, "SELECT coins FROM users WHERE id = ?", [session.userId]);
    if (!userRow || userRow.coins < cost) {
      return res.status(400).json({ error: `رصيد الكوينز غير كافٍ. تحتاج إلى ${cost} كوينز لتدوير العجلة.` });
    }

    // Deduct entry fee
    db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [cost, session.userId]);
    const deductTxId = 'tx_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'game_entry', 'رسوم تدوير عجلة الحظ')",
      [deductTxId, session.userId, -cost]
    );

    // Pick reward
    const wheelPrizes = [
      { prize: '25 كوينز', coins: 25, xp: 10 },
      { prize: '40 كوينز', coins: 40, xp: 15 },
      { prize: '60 كوينز', coins: 60, xp: 20 },
      { prize: '100 كوينز كبرى! 🌟', coins: 100, xp: 50 },
      { prize: '75 XP خبرة', coins: 10, xp: 75 },
      { prize: '30 كوينز', coins: 30, xp: 10 }
    ];
    const chosen = wheelPrizes[Math.floor(Math.random() * wheelPrizes.length)];

    if (chosen.coins > 0) {
      db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [chosen.coins, session.userId]);
      const winTxId = 'tx_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'lucky_wheel', ?)",
        [winTxId, session.userId, chosen.coins, `جائزة عجلة الحظ: ${chosen.prize}`]
      );
    }
    if (chosen.xp > 0) {
      addXp(db, session.userId, chosen.xp);
    }
    trackMissionAction(db, session.userId, 'game', 1);

    saveDb();
    return res.json({
      success: true,
      prize: chosen.prize,
      coinsEarned: chosen.coins,
      xpEarned: chosen.xp
    });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في تشغيل عجلة الحظ' });
  }
});

// Games: Daily Lucky Wheel Spin (Server-Authoritative Cooldown & Rewards)
app.post('/api/games/lucky-wheel', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'عجلة الحظ والجوائز مخصصة للحسابات المسجلة فقط. يرجى إنشاء حساب مجاني!' });
    }
    const db = await getDb();

    // Check last spin date
    const today = new Date().toISOString().slice(0, 10);
    const lastSpin = queryOne(
      db,
      "SELECT id FROM wallet_transactions WHERE user_id = ? AND type = 'lucky_wheel' AND DATE(created_at) = DATE(?)",
      [session.userId, today]
    );

    if (lastSpin) {
      return res.status(400).json({ error: 'لقد قمت بتدوير عجلة الحظ اليوم بالفعل. عد غداً لتجربة حظك مرة أخرى!' });
    }

    // Prizes options: Coins or XP
    const rewards = [
      { type: 'coins', amount: 20, label: '20 كوينز' },
      { type: 'xp', amount: 50, label: '50 XP' },
      { type: 'coins', amount: 50, label: '50 كوينز' },
      { type: 'xp', amount: 100, label: '100 XP' },
      { type: 'coins', amount: 100, label: '100 كوينز' },
      { type: 'coins', amount: 250, label: '250 كوينز كبرى! 🌟' }
    ];

    const chosen = rewards[Math.floor(Math.random() * rewards.length)];

    if (chosen.type === 'coins') {
      db.run("UPDATE users SET coins = coins + ? WHERE id = ?", [chosen.amount, session.userId]);
      const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'lucky_wheel', 'جائزة عجلة الحظ اليومية')",
        [txId, session.userId, chosen.amount]
      );
    } else {
      addXp(db, session.userId, chosen.amount);
    }

    saveDb();
    return res.json({
      success: true,
      reward: chosen,
      message: `مبروك! فزت بـ ${chosen.label}!`
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في تدوير عجلة الحظ' });
  }
});

// Games: Proverbs Quiz
app.get('/api/games/proverbs-quiz', requireAuth, async (req: Request, res: Response) => {
  const quizBank = [
    {
      id: 1,
      question: 'أكمل المثل الشعبي: "من شابه أباه فما..."',
      options: ['ظلم', 'ندم', 'خسر', 'هرم'],
      answerIndex: 0,
      explanation: 'المثل العربي الشهير: من شابه أباه فما ظلم.'
    },
    {
      id: 2,
      question: 'أكمل المثل: "الصديق وقت..."',
      options: ['الفرح', 'الضيق', 'العمل', 'السفر'],
      answerIndex: 1,
      explanation: 'الصديق الوفي يظهر وقت الشدة والضيق.'
    },
    {
      id: 3,
      question: 'أكمل المثل: "الجار قبل..."',
      options: ['الدار', 'السفر', 'المال', 'الزاد'],
      answerIndex: 0,
      explanation: 'الجار الصالح أهم من موقع الدار.'
    },
    {
      id: 4,
      question: 'أكمل المثل: "ربّ رمية من غير..."',
      options: ['قوس', 'رامٍ', 'هدف', 'سهم'],
      answerIndex: 1,
      explanation: 'يقال عند تحقق أمر صدفة دون تخطيط مسبق.'
    }
  ];

  const selected = quizBank[Math.floor(Math.random() * quizBank.length)];
  return res.json({
    id: selected.id,
    question: selected.question,
    options: selected.options
  });
});

app.post('/api/games/proverbs-quiz/answer', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'مكافآت المسابقات مخصصة للحسابات المسجلة فقط.' });
    }
    const { quizId, answerIndex } = req.body;
    const answers: Record<number, number> = { 1: 0, 2: 1, 3: 0, 4: 1 };

    const isCorrect = answers[quizId] === answerIndex;
    const db = await getDb();

    if (isCorrect) {
      db.run("UPDATE users SET coins = coins + 15 WHERE id = ?", [session.userId]);
      addXp(db, session.userId, 20);
      trackMissionAction(db, session.userId, 'game', 1);

      const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, 15, 'quiz_win', 'جائزة مسابقة الأمثال الشعبية')",
        [txId, session.userId]
      );
      saveDb();

      return res.json({
        correct: true,
        reward: 15,
        message: 'إجابة صحيحة ومميزة! ربحت 15 كوينز و 20 XP!'
      });
    } else {
      return res.json({
        correct: false,
        message: 'إجابة خاطئة! حظاً أوفر في السؤال القادم.'
      });
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في التحقق من الإجابة' });
  }
});

// TRUTH OR DARE GAME ENDPOINTS (لعبة صراحة وجرأة)
app.get('/api/games/truth-or-dare/item', requireAuth, async (req: Request, res: Response) => {
  try {
    const type = req.query.type === 'dare' ? 'dare' : 'truth';
    const category = req.query.category as string;
    const db = await getDb();

    let sql = "SELECT * FROM truth_or_dare_items WHERE type = ?";
    const params: any[] = [type];
    if (category && ['fun', 'deep', 'spicy', 'friendly'].includes(category)) {
      sql += " AND category = ?";
      params.push(category);
    }
    sql += " ORDER BY RANDOM() LIMIT 1";

    const item = queryOne(db, sql, params);
    if (!item) {
      return res.status(404).json({ error: 'لم يتم العثور على سؤال أو تحدٍ' });
    }
    return res.json({ item });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في جلب التحدي' });
  }
});

app.post('/api/games/truth-or-dare/complete', requireAuth, gameActionRateLimiter, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'مكافآت الألعاب مخصصة للحسابات المسجلة فقط.' });
    }
    const { itemId } = req.body;
    const db = await getDb();

    const item = queryOne(db, "SELECT * FROM truth_or_dare_items WHERE id = ?", [itemId]);
    if (!item) {
      return res.status(404).json({ error: 'التحدي غير موجود' });
    }

    // Daily cap check (max 10 rewarded plays per day to prevent coin abuse)
    const today = new Date().toISOString().slice(0, 10);
    const countToday = queryOne(
      db,
      "SELECT COUNT(*) as c FROM user_game_records WHERE user_id = ? AND game_type = 'truth_or_dare' AND played_at >= ?",
      [session.userId, today + ' 00:00:00']
    )?.c || 0;

    let coinsAwarded = 0;
    let xpAwarded = 0;

    if (countToday < 10) {
      coinsAwarded = item.reward_coins || 10;
      xpAwarded = item.reward_xp || 15;

      db.run("UPDATE users SET coins = coins + ?, xp = xp + ? WHERE id = ?", [coinsAwarded, xpAwarded, session.userId]);
      const txId = 'tx_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'game_reward', ?)",
        [txId, session.userId, coinsAwarded, `مكافأة إتمام تحدي ${item.type === 'truth' ? 'صراحة' : 'جرأة'}`]
      );
      addXp(db, session.userId, xpAwarded);
      trackMissionAction(db, session.userId, 'game', 1);
    }

    const recordId = 'rec_' + Math.random().toString(36).substring(2, 9);
    db.run(
      "INSERT INTO user_game_records (id, user_id, game_type, result_summary, reward_coins, reward_xp) VALUES (?, ?, 'truth_or_dare', ?, ?, ?)",
      [recordId, session.userId, `إتمام ${item.type}: ${item.question.slice(0, 40)}`, coinsAwarded, xpAwarded]
    );

    saveDb();

    return res.json({
      success: true,
      coinsAwarded,
      xpAwarded,
      message: coinsAwarded > 0 ? `أحسنت! كسبت ${coinsAwarded} كوينز و ${xpAwarded} نقطة خبرة 🌟` : 'تم إتمام التحدي بنجاح! (تم الوصول للحد اليومي للمكافآت)'
    });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في حفظ نتيجة التحدي' });
  }
});

// ==========================================
// 8.5. RANDOM CHAT ("تواصل عشوائي") & STORY ADS
// ==========================================

// Helper to get random settings
function getRandomSettings(db: any) {
  const rows = queryAll(db, "SELECT key, value FROM random_settings");
  const settings: Record<string, any> = {
    price_chat_per_min: 1,
    price_voice_per_min: 3,
    price_video_per_min: 5,
    free_attempts: 4,
    free_minutes_per_session: 5
  };
  for (const r of rows) {
    settings[r.key] = Number(r.value) || r.value;
  }
  return settings;
}

// Helper to count user's used free sessions
function getUserFreeSessionsUsed(db: any, userId: string): number {
  const row = queryOne(
    db,
    "SELECT COUNT(*) as c FROM random_sessions WHERE (user1_id = ? OR user2_id = ?) AND is_free = 1",
    [userId, userId]
  );
  return Number(row?.c || 0);
}

// 1. Random Chat Status & User Limits
app.get('/api/random-chat/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const settings = getRandomSettings(db);
    const used = getUserFreeSessionsUsed(db, session.userId);
    const freeRemaining = Math.max(0, settings.free_attempts - used);

    // Check active session if any
    const active = queryOne(
      db,
      "SELECT * FROM random_sessions WHERE (user1_id = ? OR user2_id = ?) AND status = 'active' ORDER BY started_at DESC LIMIT 1",
      [session.userId, session.userId]
    );

    let activeSessionData = null;
    if (active) {
      const partnerId = active.user1_id === session.userId ? active.user2_id : active.user1_id;
      const partner = queryOne(db, "SELECT id, username, gender, country, avatar_url, level, bio FROM users WHERE id = ?", [partnerId]);
      const partnerInterests = queryAll(db, "SELECT interest FROM user_interests WHERE user_id = ?", [partnerId]).map((r: any) => r.interest);
      const elapsedSeconds = Math.round((Date.now() - new Date(active.started_at).getTime()) / 1000);

      activeSessionData = {
        sessionId: active.id,
        partner: {
          id: partner?.id,
          username: partner?.username,
          gender: partner?.gender,
          country: partner?.country,
          avatarUrl: partner?.avatar_url,
          level: partner?.level,
          bio: partner?.bio,
          interests: partnerInterests
        },
        type: active.type,
        isFree: active.is_free === 1,
        startedAt: active.started_at,
        elapsedSeconds,
        freeDurationSeconds: settings.free_minutes_per_session * 60
      };
    }

    const userRow = queryOne(db, "SELECT coins FROM users WHERE id = ?", [session.userId]);

    return res.json({
      success: true,
      freeSessionsRemaining: freeRemaining,
      freeSessionsLimit: settings.free_attempts,
      freeMinutesPerSession: settings.free_minutes_per_session,
      prices: {
        text: settings.price_chat_per_min,
        voice: settings.price_voice_per_min,
        video: settings.price_video_per_min
      },
      userCoins: userRow?.coins || 0,
      activeSession: activeSessionData
    });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في جلب بيانات التواصل العشوائي' });
  }
});

// 2. Start Search & Matchmaking
app.post('/api/random-chat/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { type = 'text', targetGender = 'all', targetCountry = 'all', targetInterests = [] } = req.body;
    const db = await getDb();
    const settings = getRandomSettings(db);
    const userRow = queryOne(db, "SELECT id, username, gender, country, avatar_url, level, coins FROM users WHERE id = ?", [session.userId]);
    if (!userRow) return res.status(404).json({ error: 'المستخدم غير موجود' });

    const used = getUserFreeSessionsUsed(db, session.userId);
    const freeRemaining = Math.max(0, settings.free_attempts - used);

    const priceMap: Record<string, number> = {
      text: settings.price_chat_per_min || 1,
      voice: settings.price_voice_per_min || 3,
      video: settings.price_video_per_min || 5
    };
    const minRequiredCoins = priceMap[type] || 1;

    if (freeRemaining === 0 && (userRow.coins || 0) < minRequiredCoins) {
      return res.status(400).json({
        error: `لقد استنفدت جلساتك المجانية الـ ${settings.free_attempts}. تحتاج إلى ${minRequiredCoins} كوينز على الأقل لبدء جلسة جديدة.`,
        requiresCoins: true
      });
    }

    // Close any previous active sessions
    db.run("UPDATE random_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE (user1_id = ? OR user2_id = ?) AND status = 'active'", [session.userId, session.userId]);
    saveDb();

    const userInterests = queryAll(db, "SELECT interest FROM user_interests WHERE user_id = ?", [session.userId]).map((r: any) => r.interest);

    // Search queue
    let matchedCandidate: RandomChatWaiter | null = null;
    const now = Date.now();

    for (const [waiterId, waiter] of randomChatWaiters.entries()) {
      if (waiter.userId === session.userId) continue;
      if (waiter.type !== type) continue;

      if (now - waiter.queuedAt > 60000) {
        randomChatWaiters.delete(waiterId);
        continue;
      }

      const waiterSockets = connectedSockets.get(waiter.userId);
      if (!waiterSockets || waiterSockets.size === 0) {
        randomChatWaiters.delete(waiterId);
        continue;
      }

      const blockCheck = queryOne(
        db,
        "SELECT 1 FROM blocks WHERE (user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
        [session.userId, waiter.userId, waiter.userId, session.userId]
      );
      if (blockCheck) continue;

      if (targetGender !== 'all' && waiter.gender !== targetGender) continue;
      if (waiter.targetGender !== 'all' && userRow.gender !== waiter.targetGender) continue;

      if (targetCountry !== 'all' && waiter.country !== targetCountry) continue;
      if (waiter.targetCountry !== 'all' && userRow.country !== waiter.targetCountry) continue;

      matchedCandidate = waiter;
      randomChatWaiters.delete(waiterId);
      break;
    }

    if (matchedCandidate) {
      const sessionId = 'rs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const candidateUsed = getUserFreeSessionsUsed(db, matchedCandidate.userId);
      const candidateFreeRemaining = Math.max(0, settings.free_attempts - candidateUsed);
      const isFree = freeRemaining > 0 && candidateFreeRemaining > 0 ? 1 : 0;

      db.run(
        `INSERT INTO random_sessions (id, user1_id, user2_id, type, is_free, started_at, status)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
        [sessionId, session.userId, matchedCandidate.userId, type, isFree]
      );
      saveDb();

      const candidateProfile = queryOne(db, "SELECT id, username, gender, country, avatar_url, level, bio FROM users WHERE id = ?", [matchedCandidate.userId]);

      sendToUser(matchedCandidate.userId, {
        type: 'random_chat:matched',
        sessionId,
        partner: {
          id: userRow.id,
          username: userRow.username,
          gender: userRow.gender,
          country: userRow.country,
          avatarUrl: userRow.avatar_url,
          level: userRow.level,
          bio: userRow.bio || '',
          interests: userInterests
        },
        typeOfChat: type,
        isFree: isFree === 1,
        freeDurationSeconds: settings.free_minutes_per_session * 60,
        pricePerMin: priceMap[type] || 1
      });

      return res.json({
        success: true,
        matched: true,
        sessionId,
        partner: {
          id: candidateProfile?.id,
          username: candidateProfile?.username,
          gender: candidateProfile?.gender,
          country: candidateProfile?.country,
          avatarUrl: candidateProfile?.avatar_url,
          level: candidateProfile?.level,
          bio: candidateProfile?.bio || '',
          interests: matchedCandidate.interests
        },
        typeOfChat: type,
        isFree: isFree === 1,
        freeDurationSeconds: settings.free_minutes_per_session * 60,
        pricePerMin: priceMap[type] || 1
      });
    } else {
      randomChatWaiters.set(session.userId, {
        userId: session.userId,
        username: userRow.username,
        gender: userRow.gender,
        country: userRow.country,
        interests: userInterests,
        type,
        targetGender,
        targetCountry,
        targetInterests,
        queuedAt: now
      });

      return res.json({
        success: true,
        matched: false,
        queued: true,
        message: 'جاري البحث عن شخص عشوائي يطابق اختياراتك...'
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في عملية البحث والمطابقة' });
  }
});

// 3. Cancel Search Queue
app.post('/api/random-chat/cancel', requireAuth, async (req: Request, res: Response) => {
  const session = (req as any).user as UserSession;
  randomChatWaiters.delete(session.userId);
  return res.json({ success: true });
});

// 4. End Active Session
app.post('/api/random-chat/end', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { sessionId } = req.body;
    const db = await getDb();
    const settings = getRandomSettings(db);

    const active = queryOne(
      db,
      "SELECT * FROM random_sessions WHERE id = ? AND (user1_id = ? OR user2_id = ?) AND status = 'active'",
      [sessionId, session.userId, session.userId]
    );

    if (!active) {
      return res.json({ success: true, message: 'الجلسة غير نشطة' });
    }

    const partnerId = active.user1_id === session.userId ? active.user2_id : active.user1_id;
    const durationSeconds = Math.max(1, Math.round((Date.now() - new Date(active.started_at).getTime()) / 1000));

    let costCharged = 0;
    if (active.is_free === 0) {
      const priceMap: Record<string, number> = {
        text: settings.price_chat_per_min || 1,
        voice: settings.price_voice_per_min || 3,
        video: settings.price_video_per_min || 5
      };
      const rate = priceMap[active.type] || 1;
      const billedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
      costCharged = billedMinutes * rate;

      db.run("UPDATE users SET coins = MAX(0, coins - ?) WHERE id = ?", [costCharged, session.userId]);
      const txId = 'tx_rc_' + Math.random().toString(36).substring(2, 9);
      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'random_chat', ?)",
        [txId, session.userId, -costCharged, `رسوم جلسة تواصل عشوائي (${billedMinutes} دقيقة)`]
      );
    }

    db.run(
      "UPDATE random_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP, duration_seconds = ?, coins_charged = ? WHERE id = ?",
      [durationSeconds, costCharged, active.id]
    );
    saveDb();

    sendToUser(partnerId, {
      type: 'random_chat:ended',
      sessionId: active.id,
      endedBy: session.userId,
      durationSeconds
    });

    return res.json({
      success: true,
      durationSeconds,
      costCharged
    });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في إنهاء الجلسة' });
  }
});

// Story Ads Endpoints
app.get('/api/story-ads', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const ads = queryAll(db, "SELECT * FROM story_ads WHERE is_active = 1 ORDER BY priority DESC, created_at DESC");
    return res.json({ success: true, ads });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في جلب الإعلانات' });
  }
});

app.post('/api/story-ads/:id/view', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run("UPDATE story_ads SET views_count = views_count + 1 WHERE id = ?", [req.params.id]);
    saveDb();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/story-ads/:id/click', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run("UPDATE story_ads SET clicks_count = clicks_count + 1 WHERE id = ?", [req.params.id]);
    saveDb();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/admin/story-ads', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const ads = queryAll(db, "SELECT * FROM story_ads ORDER BY created_at DESC");
    return res.json({ success: true, ads });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في جلب الإعلانات' });
  }
});

app.post('/api/admin/story-ads', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const { title, description, image_url, link_url, is_active = 1, display_interval = 3, priority = 1 } = req.body;
    if (!title || !image_url) {
      return res.status(400).json({ error: 'العنوان والصورة مطلوبان' });
    }
    const db = await getDb();
    const id = 'ad_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    db.run(
      `INSERT INTO story_ads (id, title, description, image_url, link_url, is_active, display_interval, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description || '', image_url, link_url || '', is_active ? 1 : 0, Number(display_interval) || 3, Number(priority) || 1]
    );
    saveDb();
    return res.json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في إنشاء الإعلان' });
  }
});

app.put('/api/admin/story-ads/:id', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const { title, description, image_url, link_url, is_active, display_interval, priority } = req.body;
    const db = await getDb();
    db.run(
      `UPDATE story_ads SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        link_url = COALESCE(?, link_url),
        is_active = COALESCE(?, is_active),
        display_interval = COALESCE(?, display_interval),
        priority = COALESCE(?, priority)
       WHERE id = ?`,
      [title, description, image_url, link_url, is_active !== undefined ? (is_active ? 1 : 0) : null, display_interval, priority, req.params.id]
    );
    saveDb();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في تحديث الإعلان' });
  }
});

app.delete('/api/admin/story-ads/:id', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM story_ads WHERE id = ?", [req.params.id]);
    saveDb();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في حذف الإعلان' });
  }
});

app.get('/api/admin/random-settings', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const settings = getRandomSettings(db);
    return res.json({ success: true, settings });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في جلب إعدادات التواصل العشوائي' });
  }
});

app.put('/api/admin/random-settings', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const { price_chat_per_min, price_voice_per_min, price_video_per_min, free_attempts, free_minutes_per_session } = req.body;
    const db = await getDb();
    if (price_chat_per_min !== undefined) db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('price_chat_per_min', ?)", [String(price_chat_per_min)]);
    if (price_voice_per_min !== undefined) db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('price_voice_per_min', ?)", [String(price_voice_per_min)]);
    if (price_video_per_min !== undefined) db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('price_video_per_min', ?)", [String(price_video_per_min)]);
    if (free_attempts !== undefined) db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('free_attempts', ?)", [String(free_attempts)]);
    if (free_minutes_per_session !== undefined) db.run("INSERT OR REPLACE INTO random_settings (key, value) VALUES ('free_minutes_per_session', ?)", [String(free_minutes_per_session)]);
    saveDb();
    return res.json({ success: true, settings: getRandomSettings(db) });
  } catch (err) {
    return res.status(500).json({ error: 'خطأ في تحديث إعدادات التواصل العشوائي' });
  }
});

// ==========================================
// 9. AI ASSISTANT ("مساعد فضفضه")
// ==========================================

app.post('/api/assistant/chat', async (req: Request, res: Response) => {
  try {
    const { message, username, isGuest } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'يرجى كتابة رسالة للمساعد' });
    }

    const reply = await askAssistant(message, { username, isGuest });
    return res.json({ reply });
  } catch (error) {
    console.error('Assistant endpoint error:', error);
    return res.json({
      reply: 'أهلاً بك! أنا مساعد فضفضه الإرشادي. كيف يمكنني مساعدتك في استخدام المنصة والتنقل بين أقسامها الراقية؟'
    });
  }
});

// ==========================================
// 10. MEDIA UPLOAD (Base64 / Audio / Images)
// ==========================================

// Media Upload
app.post('/api/upload', requireAuth, uploadRateLimiter, async (req: Request, res: Response) => {
  try {
    const { dataUrl, fileType, fileName } = req.body;
    if (!dataUrl || !dataUrl.includes('base64,')) {
      return res.status(400).json({ error: 'ملف غير صالح' });
    }

    const parts = dataUrl.split(';base64,');
    const mime = parts[0].replace('data:', '');
    const buffer = Buffer.from(parts[1], 'base64');

    // Limit check (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'حجم الملف يتجاوز الحد الأقصى (10MB)' });
    }

    // Allowed mime types
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'];
    if (!allowedMimes.includes(mime)) {
      return res.status(400).json({ error: 'صيغة الملف غير مدعومة' });
    }

    let ext = mime.split('/')[1] || 'bin';
    if (ext.includes('webm')) ext = 'webm';

    const safeName = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(filePath, buffer);

    return res.json({
      success: true,
      url: `/uploads/${safeName}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء رفع الملف' });
  }
});

// ==========================================
// 11. NOTIFICATIONS
// ==========================================

app.get('/api/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const rows = queryAll(
      db,
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [session.userId]
    );
    return res.json({ notifications: rows });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الإشعارات' });
  }
});

app.post('/api/notifications/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    db.run("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [session.userId]);
    saveDb();
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في تحديث الإشعارات' });
  }
});

// ==========================================
// 12. ADMIN & MODERATOR PANEL
// ==========================================

app.get('/api/admin/overview', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'admin' && session.role !== 'owner' && session.role !== 'moderator') {
      return res.status(403).json({ error: 'غير مصرح بالدخول للوحة الإدارة' });
    }

    const db = await getDb();

    const totalUsers = queryOne(db, "SELECT COUNT(*) as c FROM users WHERE is_guest = 0")?.c || 0;
    const totalGuests = queryOne(db, "SELECT COUNT(*) as c FROM users WHERE is_guest = 1")?.c || 0;
    const totalRooms = queryOne(db, "SELECT COUNT(*) as c FROM rooms")?.c || 0;
    const totalReports = queryOne(db, "SELECT COUNT(*) as c FROM reports WHERE status = 'pending'")?.c || 0;
    const totalMessages = queryOne(db, "SELECT (SELECT COUNT(*) FROM private_messages) + (SELECT COUNT(*) FROM room_messages) as c")?.c || 0;

    const guestLimit = queryOne(db, "SELECT value FROM system_settings WHERE key = 'guest_message_limit'")?.value || '500';

    return res.json({
      stats: {
        totalUsers,
        totalGuests,
        totalRooms,
        pendingReports: totalReports,
        totalMessages,
        onlineCount: connectedSockets.size
      },
      guestLimit: parseInt(guestLimit, 10),
      userRole: session.role
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب بيانات الإدارة' });
  }
});

app.get('/api/admin/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'admin' && session.role !== 'owner') {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const db = await getDb();
    const users = queryAll(
      db,
      "SELECT id, username, role, gender, country, level, coins, is_banned, is_guest, created_at FROM users ORDER BY created_at DESC LIMIT 50"
    );

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب المستخدمين' });
  }
});

app.post('/api/admin/users/:id/ban', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'admin' && session.role !== 'owner' && session.role !== 'moderator') {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const targetId = req.params.id;
    const { ban, reason } = req.body;
    const db = await getDb();

    // Prevent banning Owner Hegazy
    const target = queryOne(db, "SELECT username, role FROM users WHERE id = ?", [targetId]);
    if (target?.role === 'owner' || target?.username?.toLowerCase() === 'hegazy') {
      return res.status(403).json({ error: 'لا يمكن حظر مالك ومؤسس المنصة نهائياً' });
    }

    db.run(
      "UPDATE users SET is_banned = ?, ban_reason = ? WHERE id = ?",
      [ban ? 1 : 0, reason || '', targetId]
    );

    if (ban) {
      // Disconnect sockets if online
      const sockets = connectedSockets.get(targetId);
      if (sockets) {
        for (const ws of sockets) {
          ws.close(4003, 'Account suspended');
        }
      }
    }

    saveDb();
    return res.json({ success: true, message: ban ? 'تم إيقاف الحساب' : 'تم إلغاء الإيقاف' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في تعديل حالة الحساب' });
  }
});

// Update Role (Owner Hegazy Only!)
app.post('/api/admin/users/:id/role', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const { role } = req.body;
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'رتبة غير صالحة. لا يمكن ترقية أي حساب إلى رتبة مالك' });
    }

    const db = await getDb();
    const target = queryOne(db, "SELECT username, role FROM users WHERE id = ?", [targetId]);
    if (!target) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    if (target.role === 'owner' || target.username.toLowerCase() === 'hegazy') {
      return res.status(403).json({ error: 'لا يمكن تعديل رتبة مالك ومؤسس المنصة نهائياً' });
    }

    db.run("UPDATE users SET role = ? WHERE id = ?", [role, targetId]);
    saveDb();

    return res.json({ success: true, message: `تم تحديث الرتبة إلى ${role}` });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في تعديل الرتبة' });
  }
});

// Reports list
app.get('/api/admin/reports', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'admin' && session.role !== 'owner' && session.role !== 'moderator') {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const db = await getDb();
    const reports = queryAll(
      db,
      `SELECT r.*, u1.username as reporter_username, u2.username as reported_username
       FROM reports r
       LEFT JOIN users u1 ON r.reporter_id = u1.id
       LEFT JOIN users u2 ON r.reported_user_id = u2.id
       ORDER BY r.created_at DESC`
    );

    return res.json({ reports });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب البلاغات' });
  }
});

app.post('/api/admin/reports/:id/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'admin' && session.role !== 'owner' && session.role !== 'moderator') {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const reportId = req.params.id;
    const { status, actionTaken } = req.body;
    const db = await getDb();

    db.run(
      "UPDATE reports SET status = ?, action_taken = ?, assigned_to = ? WHERE id = ?",
      [status || 'reviewed', actionTaken || '', session.username, reportId]
    );
    saveDb();

    return res.json({ success: true, message: 'تم تحديث حالة البلاغ' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في معالجة البلاغ' });
  }
});

// Update System Settings (Guest Limits, etc.) (Owner Hegazy Only)
app.put('/api/admin/settings', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const { guestMessageLimit } = req.body;
    const db = await getDb();

    if (guestMessageLimit !== undefined) {
      db.run("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('guest_message_limit', ?)", [String(guestMessageLimit)]);
    }

    saveDb();
    return res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في حفظ الإعدادات' });
  }
});

// Check SMTP status and configuration (Admin Only)
app.get('/api/admin/smtp-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'owner' && session.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    const configured = isSmtpConfigured();
    const rawUser = process.env.SMTP_USER || '';
    const maskedUser = rawUser ? (rawUser.length > 3 ? `${rawUser.slice(0, 3)}***@${rawUser.split('@')[1] || ''}` : '***') : null;

    return res.json({
      configured,
      host: process.env.SMTP_HOST || null,
      port: process.env.SMTP_PORT || '587',
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      user: maskedUser,
      from: process.env.SMTP_FROM || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب حالة البريد' });
  }
});

// Test SMTP Connection (Admin Only)
app.post('/api/admin/test-smtp', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'owner' && session.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح' });
    }

    if (!isSmtpConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'متغيرات خادم SMTP غير معرّفة في بيئة التشغيل (Environment Variables).'
      });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(400).json({
        success: false,
        error: 'تعذر إنشاء اتصال بخادم SMTP. يرجى مراجعة إعدادات المتغيرات.'
      });
    }

    try {
      await transporter.verify();
      return res.json({
        success: true,
        message: 'تم التحقق بنجاح! الاتصال بخادم SMTP والمصادقة يعملان بكفاءة 100% 🚀'
      });
    } catch (verifyErr: any) {
      console.error('[SMTP Diagnostic] Verification test failed:', verifyErr?.message || verifyErr);
      return res.status(502).json({
        success: false,
        error: `فشل التحقق من خادم SMTP: ${verifyErr?.message || 'خطأ في المصادقة أو المنفذ'}`
      });
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ أثناء اختبار اتصال البريد' });
  }
});

// ==========================================
// 9. OWNER CONTROLS: WALLET, VIP & ECONOMY
// ==========================================

// Get All VIP Plans (Owner Hegazy Only)
app.get('/api/admin/vip/plans', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const rows = queryAll(db, "SELECT * FROM vip_plans ORDER BY display_order ASC, price_coins ASC");
    const plans = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      badge: r.badge,
      color: r.color,
      border: r.border,
      text: r.text_color,
      priceCoins: r.price_coins,
      days: r.days,
      popular: r.popular === 1,
      isActive: r.is_active === 1,
      displayOrder: r.display_order,
      perks: (() => {
        try { return JSON.parse(r.perks_json || '[]'); } catch { return []; }
      })()
    }));
    return res.json({ plans });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب باقات VIP' });
  }
});

// Update VIP Plan (Owner Hegazy Only)
app.put('/api/admin/vip/plans/:id', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, icon, badge, color, border, text, priceCoins, days, popular, isActive, perks, displayOrder } = req.body;
    const db = await getDb();

    const existing = queryOne(db, "SELECT * FROM vip_plans WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: 'باقة VIP غير موجودة' });
    }

    const perksJson = Array.isArray(perks) ? JSON.stringify(perks) : (perks !== undefined ? JSON.stringify(perks) : existing.perks_json);

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        `UPDATE vip_plans
         SET name = COALESCE(?, name),
             icon = COALESCE(?, icon),
             badge = COALESCE(?, badge),
             color = COALESCE(?, color),
             border = COALESCE(?, border),
             text_color = COALESCE(?, text_color),
             price_coins = COALESCE(?, price_coins),
             days = COALESCE(?, days),
             popular = COALESCE(?, popular),
             is_active = COALESCE(?, is_active),
             perks_json = ?,
             display_order = COALESCE(?, display_order)
         WHERE id = ?`,
        [
          name ?? null,
          icon ?? null,
          badge ?? null,
          color ?? null,
          border ?? null,
          text ?? null,
          priceCoins !== undefined ? parseInt(priceCoins, 10) : null,
          days !== undefined ? parseInt(days, 10) : null,
          popular !== undefined ? (popular ? 1 : 0) : null,
          isActive !== undefined ? (isActive ? 1 : 0) : null,
          perksJson,
          displayOrder !== undefined ? parseInt(displayOrder, 10) : null,
          id
        ]
      );
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();
    return res.json({ success: true, message: `تم تحديث باقة "${name || existing.name}" بنجاح!` });
  } catch (error) {
    console.error('Update VIP plan error:', error);
    return res.status(500).json({ error: 'فشل حفظ تعديل باقة VIP' });
  }
});

// Create VIP Plan (Owner Hegazy Only)
app.post('/api/admin/vip/plans', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const { id, name, icon, badge, color, border, text, priceCoins, days, popular, isActive, perks, displayOrder } = req.body;
    if (!id || !name || priceCoins === undefined) {
      return res.status(400).json({ error: 'يرجى إدخال معرف الباقة والاسم وسعر الكوينز' });
    }

    const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const db = await getDb();
    const existing = queryOne(db, "SELECT id FROM vip_plans WHERE id = ?", [cleanId]);
    if (existing) {
      return res.status(400).json({ error: 'معرف الباقة موجود بالفعل، يرجى اختيار معرف آخر' });
    }

    const perksJson = JSON.stringify(Array.isArray(perks) ? perks : []);

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        `INSERT INTO vip_plans (id, name, icon, badge, color, border, text_color, price_coins, days, popular, is_active, perks_json, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cleanId,
          name.trim(),
          icon || '👑',
          badge || name.trim(),
          color || 'from-amber-600 to-yellow-800',
          border || 'border-amber-500',
          text || 'text-amber-300',
          parseInt(priceCoins, 10),
          days ? parseInt(days, 10) : 30,
          popular ? 1 : 0,
          isActive !== undefined ? (isActive ? 1 : 0) : 1,
          perksJson,
          displayOrder ? parseInt(displayOrder, 10) : 10
        ]
      );
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();
    return res.json({ success: true, message: `تم إنشاء باقة VIP الجديدة (${name}) بنجاح!`, planId: cleanId });
  } catch (error) {
    console.error('Create VIP plan error:', error);
    return res.status(500).json({ error: 'خطأ في إنشاء باقة VIP' });
  }
});

// Delete VIP Plan (Owner Hegazy Only)
app.delete('/api/admin/vip/plans/:id', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const db = await getDb();
    db.run("DELETE FROM vip_plans WHERE id = ?", [id]);
    saveDb();
    return res.json({ success: true, message: 'تم حذف الباقة بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'فشل حذف الباقة' });
  }
});

// Modify User Coins/Wallet (Owner Hegazy Only)
app.post('/api/admin/users/:id/coins', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const targetUserId = req.params.id;
    const { amount, operation, reason } = req.body; // operation: 'add' | 'subtract' | 'set'
    const numAmount = parseInt(amount, 10);

    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'يرجى إدخال قيمة عددية صحيحة أكبر من أو تساوي الصفر' });
    }

    const db = await getDb();
    const targetUser = queryOne(db, "SELECT id, username, coins FROM users WHERE id = ?", [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    let newCoins = targetUser.coins;
    let diff = 0;
    if (operation === 'add') {
      newCoins = targetUser.coins + numAmount;
      diff = numAmount;
    } else if (operation === 'subtract') {
      newCoins = Math.max(0, targetUser.coins - numAmount);
      diff = newCoins - targetUser.coins;
    } else if (operation === 'set') {
      newCoins = numAmount;
      diff = newCoins - targetUser.coins;
    } else {
      return res.status(400).json({ error: 'عملية غير صالحة. يرجى اختيار add أو subtract أو set' });
    }

    const txId = 'tx_adm_' + Math.random().toString(36).substring(2, 9);
    const txDesc = reason?.trim()
      ? `تعديل المالك (Hegazy): ${reason.trim()}`
      : (diff >= 0 ? `منحة كوينز من المالك Hegazy (+${diff})` : `خصم كوينز من المالك Hegazy (${diff})`);

    const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
    const notifTitle = diff >= 0 ? '🎁 تم إضافة كوينز إلى محفظتك!' : '⚠️ إشعار تعديل رصيد المحفظة';
    const notifBody = diff >= 0
      ? `قامت إدارة المنصة (المالك Hegazy) بإضافة ${diff} كوينز إلى محفظتك. رصيدك الحالي الآن: ${newCoins} كوينز. ${reason ? `(ملاحظة: ${reason})` : ''}`
      : `تم تعديل رصيدك بمقدار ${diff} كوينز بواسطة المالك Hegazy. رصيدك الحالي: ${newCoins} كوينز. ${reason ? `(السبب: ${reason})` : ''}`;

    // Execute within database transaction
    db.run("BEGIN TRANSACTION");
    try {
      db.run("UPDATE users SET coins = ? WHERE id = ?", [newCoins, targetUserId]);

      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description, related_user_id) VALUES (?, ?, ?, 'admin_adjustment', ?, ?)",
        [txId, targetUserId, diff, txDesc, session.userId]
      );

      db.run(
        "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'wallet_adjustment', ?, ?, '/wallet')",
        [notifId, targetUserId, notifTitle, notifBody]
      );

      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    // Send realtime notification if user is online
    sendToUser(targetUserId, {
      type: 'notification:new',
      notification: {
        id: notifId,
        type: 'wallet_adjustment',
        title: notifTitle,
        body: notifBody,
        link: '/wallet',
        created_at: new Date().toISOString(),
        is_read: 0
      }
    });

    sendToUser(targetUserId, {
      type: 'wallet:updated',
      coins: newCoins
    });

    return res.json({
      success: true,
      message: `تم تحديث رصيد ${targetUser.username} إلى ${newCoins} كوينز بنجاح!`,
      coins: newCoins,
      diff
    });
  } catch (error) {
    console.error('Owner update coins error:', error);
    return res.status(500).json({ error: 'خطأ في تعديل رصيد المحفظة' });
  }
});

// Modify User VIP Membership (Owner Hegazy Only)
app.post('/api/admin/users/:id/vip', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const { vipLevel, days } = req.body;

    const db = await getDb();
    const targetUser = queryOne(db, "SELECT id, username, vip_level, vip_expires_at FROM users WHERE id = ?", [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    let finalExpiresAt: string | null = null;
    const cleanLevel = (vipLevel || 'none').toLowerCase().trim();

    if (cleanLevel !== 'none') {
      const numDays = days ? parseInt(days, 10) : 30;
      finalExpiresAt = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const notifId = 'notif_' + Math.random().toString(36).substring(2, 9);
    const notifTitle = cleanLevel === 'none' ? '👑 تحديث حالة عضوية VIP' : `👑 تهانينا! تم منحك عضوية VIP ${cleanLevel.toUpperCase()}`;
    const notifBody = cleanLevel === 'none'
      ? 'تم إلغاء تفعيل عضوية VIP الخاصة بحسابك من قبل إدارة المنصة.'
      : `قامت إدارة المنصة بمنحك رتبة VIP ${cleanLevel.toUpperCase()} لمدة ${days || 30} يوماً! استمتع بكافة المميزات الملكية.`;

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        "UPDATE users SET vip_level = ?, vip_expires_at = ? WHERE id = ?",
        [cleanLevel, finalExpiresAt, targetUserId]
      );

      db.run(
        "INSERT INTO notifications (id, user_id, type, title, body, link) VALUES (?, ?, 'vip_granted', ?, ?, '/profile')",
        [notifId, targetUserId, notifTitle, notifBody]
      );
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    broadcastOnlineStatus(targetUserId, isUserOnline(targetUserId));

    sendToUser(targetUserId, {
      type: 'notification:new',
      notification: {
        id: notifId,
        type: 'vip_granted',
        title: notifTitle,
        body: notifBody,
        link: '/profile',
        created_at: new Date().toISOString(),
        is_read: 0
      }
    });

    sendToUser(targetUserId, {
      type: 'user:vip_updated',
      vipLevel: cleanLevel,
      vipExpiresAt: finalExpiresAt
    });

    return res.json({
      success: true,
      message: `تم تحديث عضوية VIP للمستخدم ${targetUser.username} إلى ${cleanLevel.toUpperCase()} بنجاح!`,
      vipLevel: cleanLevel,
      vipExpiresAt: finalExpiresAt
    });
  } catch (error) {
    console.error('Owner update user VIP error:', error);
    return res.status(500).json({ error: 'خطأ في تحديث عضوية VIP' });
  }
});

// Modify User Gamification (Level, XP, Streak) (Owner Hegazy Only)
app.post('/api/admin/users/:id/gamification', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const { level, xp, streak } = req.body;

    const db = await getDb();
    const targetUser = queryOne(db, "SELECT id, username, level, xp, streak FROM users WHERE id = ?", [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    const newLevel = level !== undefined ? Math.max(1, parseInt(level, 10)) : targetUser.level;
    const newXp = xp !== undefined ? Math.max(0, parseInt(xp, 10)) : targetUser.xp;
    const newStreak = streak !== undefined ? Math.max(0, parseInt(streak, 10)) : targetUser.streak;

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        "UPDATE users SET level = ?, xp = ?, streak = ? WHERE id = ?",
        [newLevel, newXp, newStreak, targetUserId]
      );
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();
    broadcastOnlineStatus(targetUserId, isUserOnline(targetUserId));

    return res.json({
      success: true,
      message: `تم تعديل مستوى وبيانات المستخدم ${targetUser.username} بنجاح!`,
      level: newLevel,
      xp: newXp,
      streak: newStreak
    });
  } catch (error) {
    console.error('Owner update gamification error:', error);
    return res.status(500).json({ error: 'خطأ في تعديل المستوى' });
  }
});

// Economy Stats Overview (Owner Hegazy Only)
app.get('/api/admin/economy-stats', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const totalCoinsRow = queryOne(db, "SELECT SUM(coins) as total FROM users");
    const totalCoins = totalCoinsRow?.total || 0;

    const vipCounts = queryAll(
      db,
      "SELECT vip_level, COUNT(*) as count FROM users WHERE vip_level != 'none' GROUP BY vip_level"
    );

    const topWallets = queryAll(
      db,
      "SELECT id, username, coins, level, vip_level, role, avatar_url FROM users ORDER BY coins DESC LIMIT 10"
    );

    const recentTransactions = queryAll(
      db,
      `SELECT t.*, u.username
       FROM wallet_transactions t
       JOIN users u ON t.user_id = u.id
       ORDER BY t.created_at DESC LIMIT 20`
    );

    return res.json({
      totalCoins,
      vipCounts,
      topWallets,
      recentTransactions
    });
  } catch (error) {
    console.error('Admin economy stats error:', error);
    return res.status(500).json({ error: 'خطأ في جلب إحصائيات الاقتصاد' });
  }
});

// ==========================================
// 10. SHOP & SPECIAL FEATURES ("متجر الشارات والمميزات")
// ==========================================

// Get Shop Catalog
app.get('/api/shop/items', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    let currentUserId: string | null = null;
    if (token) {
      const session = authenticateToken(db, token);
      if (session) currentUserId = session.userId;
    }

    const items = queryAll(
      db,
      "SELECT * FROM shop_items WHERE is_active = 1 ORDER BY display_order ASC, created_at DESC"
    );

    // Fetch user inventory if authenticated
    let userInventoryMap: Record<string, any> = {};
    if (currentUserId) {
      const inventory = queryAll(
        db,
        `SELECT * FROM user_inventory
         WHERE user_id = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
        [currentUserId]
      );
      for (const inv of inventory) {
        userInventoryMap[inv.item_id] = inv;
      }
    }

    const catalog = items.map(item => {
      let meta = {};
      try { meta = JSON.parse(item.metadata_json || '{}'); } catch {}
      const owned = userInventoryMap[item.id];
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        icon: item.icon,
        priceCoins: item.price_coins,
        type: item.type,
        category: item.category,
        durationHours: item.duration_hours,
        isActive: item.is_active === 1,
        displayOrder: item.display_order,
        metadata: meta,
        isOwned: !!owned,
        isEquipped: owned ? owned.is_equipped === 1 : false,
        expiresAt: owned?.expires_at || null
      };
    });

    return res.json({ items: catalog });
  } catch (error) {
    console.error('Shop items error:', error);
    return res.status(500).json({ error: 'خطأ في جلب عناصر المتجر' });
  }
});

// Get User Inventory
app.get('/api/shop/my-inventory', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    const inventory = queryAll(
      db,
      `SELECT ui.id, ui.user_id, ui.item_id, ui.is_equipped, ui.purchased_at, ui.expires_at,
              si.name, si.description, si.icon, si.price_coins, si.type, si.category,
              si.duration_hours, si.metadata_json
       FROM user_inventory ui
       JOIN shop_items si ON ui.item_id = si.id
       WHERE ui.user_id = ? AND (ui.expires_at IS NULL OR ui.expires_at > CURRENT_TIMESTAMP)
       ORDER BY ui.purchased_at DESC`,
      [session.userId]
    );

    const items = inventory.map(row => {
      let meta = {};
      try { meta = JSON.parse(row.metadata_json || '{}'); } catch {}
      return {
        id: row.id,
        userId: row.user_id,
        itemId: row.item_id,
        isEquipped: row.is_equipped === 1,
        purchasedAt: row.purchased_at,
        expiresAt: row.expires_at,
        item: {
          id: row.item_id,
          name: row.name,
          description: row.description,
          icon: row.icon,
          priceCoins: row.price_coins,
          type: row.type,
          category: row.category,
          durationHours: row.duration_hours,
          metadata: meta
        }
      };
    });

    return res.json({ inventory: items });
  } catch (error) {
    console.error('Inventory error:', error);
    return res.status(500).json({ error: 'خطأ في جلب مقتنياتك' });
  }
});

// Purchase Item
app.post('/api/shop/buy', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.isGuest) {
      return res.status(403).json({ error: 'عذراً، المتجر متاح فقط للأعضاء المسجلين. يرجى إنشاء حساب مجاني.' });
    }

    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: 'يرجى تحديد العنصر المطلوب' });
    }

    const db = await getDb();
    const item = queryOne(db, "SELECT * FROM shop_items WHERE id = ? AND is_active = 1", [itemId]);
    if (!item) {
      return res.status(404).json({ error: 'العنصر المطلوب غير موجود أو غير متاح حالياً' });
    }

    // Check user coin balance server-side
    const user = queryOne(db, "SELECT coins FROM users WHERE id = ?", [session.userId]);
    if (!user || user.coins < item.price_coins) {
      return res.status(400).json({
        error: `رصيد الكوينز غير كافٍ. تحتاج إلى ${item.price_coins} كوينز (رصيدك الحالي: ${user?.coins || 0})`
      });
    }

    // Check existing inventory for permanent badges
    const existing = queryOne(
      db,
      "SELECT * FROM user_inventory WHERE user_id = ? AND item_id = ? AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
      [session.userId, itemId]
    );

    if (existing && item.type === 'badge') {
      return res.status(400).json({ error: 'أنت تمتلك هذه الشارة بالفعل!' });
    }

    // Calculate expiration if duration is applicable
    let expiresAt: string | null = null;
    if (item.duration_hours && item.duration_hours > 0) {
      const baseTime = (existing && existing.expires_at && new Date(existing.expires_at).getTime() > Date.now())
        ? new Date(existing.expires_at).getTime()
        : Date.now();
      expiresAt = new Date(baseTime + item.duration_hours * 3600 * 1000).toISOString();
    }

    // Deduct coins securely inside database transaction
    const txId = 'tx_' + crypto.randomUUID();
    const shouldAutoEquip = item.type === 'pin_profile' || item.type === 'card_frame' || item.type === 'badge';
    const invId = existing ? existing.id : ('inv_' + crypto.randomUUID());

    db.run("BEGIN TRANSACTION");
    try {
      db.run("UPDATE users SET coins = coins - ? WHERE id = ?", [item.price_coins, session.userId]);

      db.run(
        "INSERT INTO wallet_transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, 'shop_purchase', ?)",
        [txId, session.userId, -item.price_coins, `شراء من المتجر: ${item.name}`]
      );

      if (shouldAutoEquip) {
        db.run(
          `UPDATE user_inventory
           SET is_equipped = 0
           WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)`,
          [session.userId, item.type]
        );
      }

      if (existing) {
        db.run(
          "UPDATE user_inventory SET expires_at = ?, is_equipped = ?, purchased_at = CURRENT_TIMESTAMP WHERE id = ?",
          [expiresAt, shouldAutoEquip ? 1 : existing.is_equipped, existing.id]
        );
      } else {
        db.run(
          "INSERT INTO user_inventory (id, user_id, item_id, is_equipped, expires_at) VALUES (?, ?, ?, ?, ?)",
          [invId, session.userId, itemId, shouldAutoEquip ? 1 : 0, expiresAt]
        );
      }

      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    // Broadcast presence update so badge/frame/pin reflects in realtime
    broadcastOnlineStatus(session.userId, true);

    const updatedUser = queryOne(db, "SELECT coins FROM users WHERE id = ?", [session.userId]);

    return res.json({
      success: true,
      message: `تم شراء "${item.name}" بنجاح!`,
      coins: updatedUser?.coins || 0
    });
  } catch (error) {
    console.error('Purchase error:', error);
    return res.status(500).json({ error: 'حدث خطأ أثناء عملية الشراء' });
  }
});

// Equip/Unequip Item
app.post('/api/shop/equip', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { itemId, equip } = req.body;
    const db = await getDb();

    const inv = queryOne(
      db,
      `SELECT ui.*, si.type FROM user_inventory ui
       JOIN shop_items si ON ui.item_id = si.id
       WHERE ui.user_id = ? AND ui.item_id = ?
         AND (ui.expires_at IS NULL OR ui.expires_at > CURRENT_TIMESTAMP)`,
      [session.userId, itemId]
    );

    if (!inv) {
      return res.status(404).json({ error: 'أنت لا تملك هذا العنصر أو انتهت صلاحيته' });
    }

    if (equip) {
      // Unequip existing item of same type
      db.run(
        `UPDATE user_inventory
         SET is_equipped = 0
         WHERE user_id = ? AND item_id IN (SELECT id FROM shop_items WHERE type = ?)`,
        [session.userId, inv.type]
      );
      db.run("UPDATE user_inventory SET is_equipped = 1 WHERE id = ?", [inv.id]);
    } else {
      db.run("UPDATE user_inventory SET is_equipped = 0 WHERE id = ?", [inv.id]);
    }

    saveDb();
    broadcastOnlineStatus(session.userId, true);

    return res.json({ success: true, isEquipped: !!equip });
  } catch (error) {
    console.error('Equip error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تفعيل/إلغاء تفعيل العنصر' });
  }
});

// Owner Hegazy Only: Add Shop Item
app.post('/api/shop/items', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const { name, description, icon, priceCoins, type, category, durationHours, displayOrder, metadata } = req.body;
    if (!name || !priceCoins || !type) {
      return res.status(400).json({ error: 'يرجى استكمال البيانات الأساسية للعنصر' });
    }

    const id = 'shop_' + (type === 'badge' ? 'badge_' : 'feat_') + Date.now();
    const db = await getDb();

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        `INSERT INTO shop_items (
          id, name, description, icon, price_coins, type, category, duration_hours,
          display_order, is_active, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          id,
          name.trim(),
          description || '',
          icon || '⭐',
          parseInt(priceCoins, 10),
          type,
          category || 'distinctive',
          durationHours ? parseInt(durationHours, 10) : null,
          displayOrder ? parseInt(displayOrder, 10) : 0,
          JSON.stringify(metadata || {})
        ]
      );
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    return res.json({ success: true, itemId: id });
  } catch (error) {
    console.error('Add shop item error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إضافة العنصر للمتجر' });
  }
});

// Owner Hegazy Only: Edit Shop Item
app.put('/api/shop/items/:id', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { name, description, icon, priceCoins, durationHours, isActive, displayOrder, metadata } = req.body;
    const db = await getDb();

    const existing = queryOne(db, "SELECT * FROM shop_items WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: 'العنصر غير موجود في المتجر' });
    }

    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        `UPDATE shop_items
         SET name = COALESCE(?, name),
             description = COALESCE(?, description),
             icon = COALESCE(?, icon),
             price_coins = COALESCE(?, price_coins),
             duration_hours = ?,
             is_active = COALESCE(?, is_active),
             display_order = COALESCE(?, display_order),
             metadata_json = COALESCE(?, metadata_json)
         WHERE id = ?`,
        [
          name ? name.trim() : null,
          description ?? null,
          icon ?? null,
          priceCoins !== undefined ? parseInt(priceCoins, 10) : null,
          durationHours !== undefined ? (durationHours ? parseInt(durationHours, 10) : null) : null,
          isActive !== undefined ? (isActive ? 1 : 0) : null,
          displayOrder !== undefined ? parseInt(displayOrder, 10) : null,
          metadata ? JSON.stringify(metadata) : null,
          id
        ]
      );
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    return res.json({ success: true, message: 'تم تحديث العنصر بنجاح' });
  } catch (error) {
    console.error('Update shop item error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تحديث عنصر المتجر' });
  }
});

// Owner Hegazy Only: Delete / Disable Shop Item
app.delete('/api/shop/items/:id', requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const db = await getDb();

    db.run("BEGIN TRANSACTION");
    try {
      db.run("UPDATE shop_items SET is_active = 0 WHERE id = ?", [id]);
      db.run("COMMIT");
    } catch (txErr) {
      db.run("ROLLBACK");
      throw txErr;
    }

    saveDb();

    return res.json({ success: true, message: 'تم تعطيل العنصر بنجاح' });
  } catch (error) {
    console.error('Delete shop item error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تعطيل العنصر' });
  }
});

// ==========================================
// 16. EVENTS AND PLATFORM POSTS & NEWS
// ==========================================

// GET /api/events
app.get('/api/events', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const filter = (req.query.filter as string) || 'all'; // 'all', 'upcoming', 'past'
    const db = await getDb();

    let sql = `
      SELECT e.*, u.username as creator_name, u.role as creator_role,
             (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participants_count,
             (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND user_id = ?) as is_joined
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
    `;
    const params: any[] = [session.userId];

    if (filter === 'upcoming') {
      sql += ` WHERE (e.status = 'upcoming' OR e.status = 'ongoing' OR datetime(e.start_time) >= datetime('now')) AND e.status != 'completed'`;
    } else if (filter === 'past') {
      sql += ` WHERE e.status = 'completed' OR (datetime(e.start_time) < datetime('now') AND e.status != 'upcoming')`;
    }

    sql += ` ORDER BY CASE WHEN e.status = 'upcoming' THEN 0 WHEN e.status = 'ongoing' THEN 1 ELSE 2 END, e.start_time DESC`;

    const rows = queryAll(db, sql, params);
    const events = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      startTime: r.start_time,
      endTime: r.end_time,
      createdAt: r.created_at,
      createdBy: r.created_by,
      creatorName: r.creator_name || 'إدارة فضفضه',
      creatorRole: r.creator_role || 'owner',
      maxParticipants: r.max_participants || 100,
      imageUrl: r.image_url || '',
      status: r.status || 'upcoming',
      location: r.location || 'المجلس العام',
      timeDisplay: r.time_display || '',
      dateDisplay: r.date_display || '',
      participantsCount: Number(r.participants_count) || 0,
      isJoined: Number(r.is_joined) > 0
    }));

    return res.json({ events });
  } catch (error) {
    console.error('Events list error:', error);
    return res.status(500).json({ error: 'خطأ أثناء جلب قائمة الفعاليات' });
  }
});

// GET /api/events/:id
app.get('/api/events/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const eventId = req.params.id;

    const r = queryOne(
      db,
      `SELECT e.*, u.username as creator_name, u.role as creator_role,
              (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participants_count,
              (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id AND user_id = ?) as is_joined
       FROM events e
       LEFT JOIN users u ON e.created_by = u.id
       WHERE e.id = ?`,
      [session.userId, eventId]
    );

    if (!r) {
      return res.status(404).json({ error: 'الفعالية غير موجودة' });
    }

    const participants = queryAll(
      db,
      `SELECT u.id, u.username, u.avatar_url, u.role, u.gender, ep.joined_at
       FROM event_participants ep
       JOIN users u ON ep.user_id = u.id
       WHERE ep.event_id = ?
       ORDER BY ep.joined_at DESC
       LIMIT 50`,
      [eventId]
    );

    const event = {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      startTime: r.start_time,
      endTime: r.end_time,
      createdAt: r.created_at,
      createdBy: r.created_by,
      creatorName: r.creator_name || 'إدارة فضفضه',
      creatorRole: r.creator_role || 'owner',
      maxParticipants: r.max_participants || 100,
      imageUrl: r.image_url || '',
      status: r.status || 'upcoming',
      location: r.location || 'المجلس العام',
      timeDisplay: r.time_display || '',
      dateDisplay: r.date_display || '',
      participantsCount: Number(r.participants_count) || 0,
      isJoined: Number(r.is_joined) > 0,
      participants
    };

    return res.json({ event });
  } catch (error) {
    console.error('Event detail error:', error);
    return res.status(500).json({ error: 'خطأ أثناء جلب تفاصيل الفعالية' });
  }
});

// POST /api/events/:id/join (toggle join/leave)
app.post('/api/events/:id/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const eventId = req.params.id;

    const event = queryOne(db, "SELECT id, status, max_participants FROM events WHERE id = ?", [eventId]);
    if (!event) {
      return res.status(404).json({ error: 'الفعالية غير موجودة' });
    }

    const existing = queryOne(
      db,
      "SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ?",
      [eventId, session.userId]
    );

    if (existing) {
      db.run("DELETE FROM event_participants WHERE event_id = ? AND user_id = ?", [eventId, session.userId]);
      saveDb();
      const count = queryOne(db, "SELECT COUNT(*) as c FROM event_participants WHERE event_id = ?", [eventId])?.c || 0;
      return res.json({ success: true, isJoined: false, participantsCount: count, message: 'تم إلغاء التسجيل في الفعالية' });
    } else {
      if (event.status === 'completed') {
        return res.status(400).json({ error: 'هذه الفعالية منتهية بالفعل' });
      }
      const currentCount = queryOne(db, "SELECT COUNT(*) as c FROM event_participants WHERE event_id = ?", [eventId])?.c || 0;
      if (currentCount >= event.max_participants) {
        return res.status(400).json({ error: 'اكتمل الحد الأقصى للمشاركين في هذه الفعالية' });
      }

      db.run(
        "INSERT OR REPLACE INTO event_participants (event_id, user_id, joined_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        [eventId, session.userId]
      );
      saveDb();
      const count = queryOne(db, "SELECT COUNT(*) as c FROM event_participants WHERE event_id = ?", [eventId])?.c || 0;
      return res.json({ success: true, isJoined: true, participantsCount: count, message: 'تم تأكيد تسجيلك في الفعالية بنجاح!' });
    }
  } catch (error) {
    console.error('Event join error:', error);
    return res.status(500).json({ error: 'خطأ أثناء التسجيل في الفعالية' });
  }
});

// POST /api/events (Owner Only)
app.post(['/api/events', '/api/admin/events'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { title, description, category, startTime, endTime, maxParticipants, imageUrl, location, timeDisplay, dateDisplay, status } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'العنوان والوصف مطلوبان' });
    }

    const db = await getDb();
    const id = `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    db.run(
      `INSERT INTO events (id, title, description, category, start_time, end_time, created_by, max_participants, image_url, status, location, time_display, date_display)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title.trim(),
        description.trim(),
        category || 'عام',
        startTime || new Date().toISOString(),
        endTime || null,
        session.userId,
        Number(maxParticipants) || 150,
        imageUrl || '',
        status || 'upcoming',
        location || 'المجلس العام',
        timeDisplay || '08:00 م',
        dateDisplay || new Date().toLocaleDateString('ar-EG')
      ]
    );

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'create_event', 'event', ?, ?)`,
      [logId, session.userId, id, `تم إنشاء فعالية جديدة: ${title.trim()}`]
    );

    saveDb();
    return res.json({ success: true, eventId: id, message: 'تم إنشاء الفعالية بنجاح' });
  } catch (error) {
    console.error('Create event error:', error);
    return res.status(500).json({ error: 'خطأ أثناء إنشاء الفعالية' });
  }
});

// PUT /api/events/:id (Owner Only)
app.put(['/api/events/:id', '/api/admin/events/:id'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const eventId = req.params.id;
    const { title, description, category, maxParticipants, imageUrl, location, timeDisplay, dateDisplay, status } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'العنوان والوصف مطلوبان' });
    }

    const db = await getDb();
    const existing = queryOne(db, "SELECT id, title FROM events WHERE id = ?", [eventId]);
    if (!existing) {
      return res.status(404).json({ error: 'الفعالية غير موجودة' });
    }

    db.run(
      `UPDATE events SET
         title = ?,
         description = ?,
         category = ?,
         max_participants = ?,
         image_url = ?,
         status = ?,
         location = ?,
         time_display = ?,
         date_display = ?
       WHERE id = ?`,
      [
        title.trim(),
        description.trim(),
        category || 'عام',
        Number(maxParticipants) || 150,
        imageUrl || '',
        status || 'upcoming',
        location || 'المجلس العام',
        timeDisplay || '08:00 م',
        dateDisplay || '',
        eventId
      ]
    );

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'update_event', 'event', ?, ?)`,
      [logId, session.userId, eventId, `تم تعديل الفعالية: ${title.trim()}`]
    );

    saveDb();
    return res.json({ success: true, message: 'تم تحديث الفعالية بنجاح' });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تحديث الفعالية' });
  }
});

// DELETE /api/events/:id (Owner Only)
app.delete(['/api/events/:id', '/api/admin/events/:id'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const eventId = req.params.id;
    const db = await getDb();

    const existing = queryOne(db, "SELECT id, title FROM events WHERE id = ?", [eventId]);
    if (!existing) {
      return res.status(404).json({ error: 'الفعالية غير موجودة' });
    }

    db.run("DELETE FROM events WHERE id = ?", [eventId]);

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'delete_event', 'event', ?, ?)`,
      [logId, session.userId, eventId, `تم حذف الفعالية: ${existing.title}`]
    );

    saveDb();
    return res.json({ success: true, message: 'تم حذف الفعالية بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ أثناء حذف الفعالية' });
  }
});

// GET /api/news (Official Posts & News)
app.get('/api/news', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();

    const rows = queryAll(
      db,
      `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
       FROM platform_posts p
       LEFT JOIN users u ON p.author_id = u.id
       ORDER BY p.is_pinned DESC, p.created_at DESC`,
      [session.userId]
    );

    const posts = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      imageUrl: r.image_url || '',
      category: r.category || 'تحديثات',
      isPinned: r.is_pinned === 1,
      viewsCount: r.views_count || 0,
      createdAt: r.created_at,
      authorId: r.author_id,
      authorName: r.author_name || 'Hegazy',
      authorRole: r.author_role || 'owner',
      authorAvatar: r.author_avatar || '',
      likesCount: Number(r.likes_count) || 0,
      isLiked: Number(r.is_liked) > 0
    }));

    return res.json({ posts });
  } catch (error) {
    console.error('News list error:', error);
    return res.status(500).json({ error: 'خطأ أثناء جلب المنشورات والأخبار' });
  }
});

// GET /api/news/:id
app.get('/api/news/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const postId = req.params.id;

    // Increment views
    db.run("UPDATE platform_posts SET views_count = views_count + 1 WHERE id = ?", [postId]);
    saveDb();

    const r = queryOne(
      db,
      `SELECT p.*, u.username as author_name, u.avatar_url as author_avatar, u.role as author_role,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
       FROM platform_posts p
       LEFT JOIN users u ON p.author_id = u.id
       WHERE p.id = ?`,
      [session.userId, postId]
    );

    if (!r) {
      return res.status(404).json({ error: 'المنشور غير موجود' });
    }

    const post = {
      id: r.id,
      title: r.title,
      content: r.content,
      imageUrl: r.image_url || '',
      category: r.category || 'تحديثات',
      isPinned: r.is_pinned === 1,
      viewsCount: (r.views_count || 0) + 1,
      createdAt: r.created_at,
      authorId: r.author_id,
      authorName: r.author_name || 'Hegazy',
      authorRole: r.author_role || 'owner',
      authorAvatar: r.author_avatar || '',
      likesCount: Number(r.likes_count) || 0,
      isLiked: Number(r.is_liked) > 0
    };

    return res.json({ post });
  } catch (error) {
    console.error('News detail error:', error);
    return res.status(500).json({ error: 'خطأ أثناء جلب تفاصيل المنشور' });
  }
});

// POST /api/news/:id/like
app.post('/api/news/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const db = await getDb();
    const postId = req.params.id;

    const existing = queryOne(
      db,
      "SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?",
      [postId, session.userId]
    );

    if (existing) {
      db.run("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?", [postId, session.userId]);
      saveDb();
      const count = queryOne(db, "SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?", [postId])?.c || 0;
      return res.json({ success: true, isLiked: false, likesCount: count });
    } else {
      db.run(
        "INSERT OR REPLACE INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        [postId, session.userId]
      );
      saveDb();
      const count = queryOne(db, "SELECT COUNT(*) as c FROM post_likes WHERE post_id = ?", [postId])?.c || 0;
      return res.json({ success: true, isLiked: true, likesCount: count });
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ أثناء التفاعل مع المنشور' });
  }
});

// POST /api/news (Owner Only)
app.post(['/api/news', '/api/admin/news'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const { title, content, imageUrl, category, isPinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'عنوان المنشور ومحتواه مطلوبان' });
    }

    const db = await getDb();
    const id = `post_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    db.run(
      `INSERT INTO platform_posts (id, title, content, image_url, author_id, category, is_pinned, views_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        title.trim(),
        content.trim(),
        imageUrl || '',
        session.userId,
        category || 'تحديثات المنصة',
        isPinned ? 1 : 0
      ]
    );

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'create_news', 'news', ?, ?)`,
      [logId, session.userId, id, `تم نشر خبر جديد: ${title.trim()}`]
    );

    saveDb();
    return res.json({ success: true, postId: id, message: 'تم نشر الخبر بنجاح!' });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ error: 'خطأ أثناء نشر الخبر' });
  }
});

// PUT /api/news/:id (Owner Only)
app.put(['/api/news/:id', '/api/admin/news/:id'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const postId = req.params.id;
    const { title, content, imageUrl, category, isPinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'عنوان المنشور ومحتواه مطلوبان' });
    }

    const db = await getDb();
    const existing = queryOne(db, "SELECT id, title FROM platform_posts WHERE id = ?", [postId]);
    if (!existing) {
      return res.status(404).json({ error: 'المنشور غير موجود' });
    }

    db.run(
      `UPDATE platform_posts SET
         title = ?,
         content = ?,
         image_url = ?,
         category = ?,
         is_pinned = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title.trim(),
        content.trim(),
        imageUrl || '',
        category || 'تحديثات المنصة',
        isPinned ? 1 : 0,
        postId
      ]
    );

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'update_news', 'news', ?, ?)`,
      [logId, session.userId, postId, `تم تعديل المنشور: ${title.trim()}`]
    );

    saveDb();
    return res.json({ success: true, message: 'تم تحديث الخبر بنجاح!' });
  } catch (error) {
    console.error('Update post error:', error);
    return res.status(500).json({ error: 'خطأ أثناء تحديث الخبر' });
  }
});

// DELETE /api/news/:id (Owner Only)
app.delete(['/api/news/:id', '/api/admin/news/:id'], requireAuth, requireOwner, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    const postId = req.params.id;
    const db = await getDb();

    const existing = queryOne(db, "SELECT id, title FROM platform_posts WHERE id = ?", [postId]);
    if (!existing) {
      return res.status(404).json({ error: 'المنشور غير موجود' });
    }

    db.run("DELETE FROM platform_posts WHERE id = ?", [postId]);

    // Audit log
    const logId = `log_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    db.run(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details)
       VALUES (?, ?, 'delete_news', 'news', ?, ?)`,
      [logId, session.userId, postId, `تم حذف المنشور: ${existing.title}`]
    );

    saveDb();
    return res.json({ success: true, message: 'تم حذف المنشور بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ أثناء حذف المنشور' });
  }
});

// ==========================================
// OWNER BOOTSTRAP SYSTEM
// ==========================================
async function ensureOwnerBootstrap() {
  const db = await getDb();
  const existing = queryOne(
    db,
    "SELECT id, username, email, email_verified, email_verified_at, role FROM users WHERE LOWER(username) = 'hegazy'"
  );

  const ownerId = 'usr_1790285919516_kn7t3';
  const ownerEmail = 'hegazymr6@gmail.com';

  if (!existing) {
    const initialPass = process.env.OWNER_INITIAL_PASSWORD || crypto.randomBytes(16).toString('hex');
    const { hash, salt } = hashPassword(initialPass);
    db.run(
      `INSERT INTO users (
        id, username, email, email_verified, email_verified_at, password_hash, salt, role, gender, country, date_of_birth,
        bio, coins, xp, level, streak, vip_level, is_guest, referral_code
      ) VALUES (?, 'Hegazy', ?, 0, NULL, ?, ?, 'owner', 'male', 'مصر', '1998-01-01',
        'مؤسس ومالك منصة فضفضه الاجتماعية 👑', 99999, 50000, 50, 10, 'royal', 0, 'HEGAZY-OWNER')`,
      [ownerId, ownerEmail, hash, salt]
    );
    saveDb();
    console.log('[Owner Bootstrap] Initialized Owner account Hegazy server-side');
  } else {
    // Strictly enforce role as 'owner' and ensure owner email is linked (without assuming verified)
    if (existing.role !== 'owner' || existing.email !== ownerEmail) {
      db.run("UPDATE users SET role = 'owner', email = ? WHERE LOWER(username) = 'hegazy'", [ownerEmail]);
      saveDb();
      console.log('[Owner Bootstrap] Linked email and preserved owner role for Hegazy:', ownerEmail);
    }
  }

  // Prevent any other user from having 'owner' role server-side
  db.run("UPDATE users SET role = 'user' WHERE role = 'owner' AND LOWER(username) != 'hegazy'");
  saveDb();

  // Send real verification email to owner Hegazy if not verified yet
  const ownerRecord = queryOne(db, "SELECT id, username, email, email_verified FROM users WHERE LOWER(username) = 'hegazy'");
  if (ownerRecord && ownerRecord.email_verified !== 1) {
    const pending = queryOne(
      db,
      "SELECT id FROM email_verifications WHERE user_id = ? AND verified_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
      [ownerId]
    );
    if (!pending) {
      const siteUrl = process.env.APP_URL || 'http://localhost:3000';
      await createAndSendVerification(db, ownerId, ownerEmail, 'Hegazy', siteUrl);
      console.log('[Owner Bootstrap] Dispatched verification email to owner:', ownerEmail);
    }
  }
}

// ==========================================
// VITE MIDDLEWARE OR STATIC SERVE
// ==========================================

// Admin Database Backups Management
app.get('/api/admin/backups', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'owner' && session.role !== 'admin') {
      return res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
    }
    const backupDir = path.resolve(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [] });
    }
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('fadfada_backup_') && f.endsWith('.sqlite'))
      .map(fileName => {
        const stats = fs.statSync(path.join(backupDir, fileName));
        return {
          fileName,
          sizeKb: Math.round(stats.size / 1024),
          createdAt: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ backups: files });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب قائمة النسخ الاحتياطية' });
  }
});

app.post('/api/admin/backup', requireAuth, async (req: Request, res: Response) => {
  try {
    const session = (req as any).user as UserSession;
    if (session.role !== 'owner' && session.role !== 'admin') {
      return res.status(403).json({ error: 'صلاحية الإدارة مطلوبة' });
    }
    const db = await getDb();
    const { runDatabaseBackup } = await import('./server/cron.js');
    runDatabaseBackup(db);
    return res.json({ success: true, message: 'تم إنشاء نسخة احتياطية آمنة لقاعدة البيانات بنجاح' });
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إنشاء النسخة الاحتياطية' });
  }
});

// Global Express Error Handler Middleware (Prevents HTML stack traces and crashes)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err) {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'صيغة JSON المرسلة غير صالحة' });
    }
    if (err.status === 413 || err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'حجم البيانات المرسلة كبير جداً' });
    }
    console.error('[Express Unhandled Error]:', err);
    return res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
  }
  next();
});

// Graceful Shutdown System (Prevents SQLite data loss on container restart/SIGTERM)
function handleGracefulShutdown(signal: string) {
  console.log(`[Fadfada Platform] Received ${signal}. Flushing database buffer to disk and shutting down gracefully...`);
  try {
    saveDbSync();
    console.log('[Fadfada Platform] Database buffer persisted successfully.');
  } catch (err) {
    console.error('[Fadfada Platform] Error flushing database on shutdown:', err);
  }
  process.exit(0);
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

async function setupVite() {
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'));

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  // Pre-initialize DB and Owner account
  const db = await getDb();
  // Clear any zombie online sessions on server startup
  db.run("UPDATE sessions SET is_online = 0 WHERE is_online = 1");
  saveDb();

  await ensureOwnerBootstrap();
  initCronJobs(db);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Fadfada Platform] Running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch(err => {
  console.error('Failed to start Fadfada server:', err);
});
