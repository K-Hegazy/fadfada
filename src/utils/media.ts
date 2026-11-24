const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav'];

export function validateImageFile(file: File, maxMb = 5): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('يرجى اختيار صورة بصيغة JPG أو PNG أو WEBP أو GIF.');
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`حجم الصورة يجب ألا يتجاوز ${maxMb} ميجابايت.`);
  }
}

export function validateVideoFile(file: File, maxMb = 15): void {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    throw new Error('يرجى اختيار فيديو بصيغة MP4 أو WEBM أو MOV.');
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`حجم الفيديو يجب ألا يتجاوز ${maxMb} ميجابايت.`);
  }
}

export function validateAudioBlob(blob: Blob, maxMb = 10): void {
  const baseType = blob.type.split(';')[0];
  if (baseType && !ALLOWED_AUDIO_TYPES.includes(baseType)) {
    throw new Error('صيغة التسجيل الصوتي غير مدعومة.');
  }
  if (blob.size > maxMb * 1024 * 1024) {
    throw new Error(`حجم التسجيل الصوتي يجب ألا يتجاوز ${maxMb} ميجابايت.`);
  }
}

export async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<Blob> {
  validateImageFile(file, 8);
  if (file.type === 'image/gif') {
    return file;
  }

  return await new Promise<Blob>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob ?? file);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

let audioCtx: AudioContext | null = null;

export function playNotificationChime(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) {
      audioCtx = new Ctx();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  } catch {
    // Ignore autoplay-blocked audio context errors
  }
}
