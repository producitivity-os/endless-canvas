export const theme = {
  interaction: {
    hoverColor: 0x3b82f6,
    frameWidth: 2,
  },
  elements: {
    card: {
      outline: {
        padding: 2,
        color: 0x3b82f6,
        width: 2.5,
        alpha: 0.9,
      },
      radius: 14,
    },
    text: {
      primary: 0x161922,
      secondary: 0x4d5565,
      height: 52,
      minTextCardWidth: 80,
      padding: {
        top: 0,
        left: 12,
        bottom: 0,
        right: 12,
      },
    },
  },
};

export function blendColor(color: number, target: number, amount: number): number {
  const mix = (shift: number) => {
    const sourceChannel = (color >> shift) & 0xff;
    const targetChannel = (target >> shift) & 0xff;
    return Math.round(sourceChannel + (targetChannel - sourceChannel) * amount);
  };

  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
