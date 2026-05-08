import { Capacitor } from "@capacitor/core";

export function isNative() {
  return Capacitor.isNativePlatform();
}

export async function takePhoto(): Promise<File | null> {
  if (!isNative()) return null;

  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");

  const image = await Camera.getPhoto({
    quality: 85,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Prompt, // lets user choose camera or gallery
  });

  if (!image.dataUrl) return null;

  const res = await fetch(image.dataUrl);
  const blob = await res.blob();
  const ext = image.format || "jpeg";
  return new File([blob], `photo_${Date.now()}.${ext}`, { type: blob.type });
}
