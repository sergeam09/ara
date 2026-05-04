export async function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    ratio: img.naturalWidth / img.naturalHeight
                });
            };
            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            img.src = e.target?.result;
        };
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
    });
}
export function calculateGridDimensions(imageRatio, baseWidth = 150) {
    return {
        width: baseWidth,
        height: baseWidth / imageRatio,
        ratio: imageRatio,
        cellSize: baseWidth / 10
    };
}
