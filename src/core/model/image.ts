// image.ts

export async function imageDataUrlSize(
  dataUrl: string,
): Promise<{
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      reject(
        new Error(
          "Failed to load image from data URL.",
        ),
      );
    };

    image.src = dataUrl;
  });
}
