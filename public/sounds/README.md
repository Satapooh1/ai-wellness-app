# Audio Samples — /public/sounds/

วางไฟล์เสียงคุณภาพสูงไว้ที่นี่ เพื่อให้ Hybrid Audio Engine โหลดใช้งาน
หากไม่มีไฟล์ ระบบจะ fallback เป็น Procedural Synthesis อัตโนมัติ

## ไฟล์ที่ต้องการ

| ไฟล์ | ความยาวแนะนำ | คำอธิบาย |
|------|-------------|----------|
| `rain.mp3` | 1-3 นาที (loop) | เสียงฝนตก ธรรมชาติ ไม่มีดนตรี |
| `ocean.mp3` | 1-3 นาที (loop) | เสียงคลื่นทะเล ควรมี texture ชัด |
| `forest.mp3` | 1-3 นาที (loop) | เสียงป่า + นก + ลม |

## แหล่งดาวน์โหลดฟรี (Royalty-Free)

- https://freesound.org (ต้องสมัครฟรี)
- https://pixabay.com/sound-effects/
- https://mixkit.co/free-sound-effects/nature/

## Note: Ocean LFO Technique

ไฟล์ ocean.mp3 จะถูก Web Audio API ประมวลผลซ้ำดังนี้:
- LFO เดียว (0.08Hz) คุม Gain + Filter.frequency พร้อมกัน
- Wave crash: Gain สูง + Filter 1500Hz (เสียงสว่าง/เปิด)
- Wave recede: Gain ต่ำ + Filter 100Hz (เสียงทุ้ม/ปิด)

เพื่อให้ technique นี้ได้ผลดีที่สุด ให้เลือกไฟล์ ocean.mp3
ที่มีเสียง broadband (ไม่ cut-off เองมากเกินไป)
