interface Asset {
    id: string;
    w: number;
    h: number;
    u: string;
    p: string;
    e: number;
  }
  
  interface Layer {
    ddd: number;
    ind: number;
    ty: number;
    nm: string;
    sr: number;
    ks: any;
    ao: number;
    ip: number;
    op: number;
    st: number;
    bm: number;
  }
  
  export interface Animation {
    v: string;
    fr: number;
    ip: number;
    op: number;
    w: number;
    h: number;
    nm: string;
    ddd: number;
    assets: Asset[];
    layers: Layer[];
    markers: any[];
  }

  export const EDA_ANIMATIONS_BASE_PATH = 's3://accessible-ai/public/assets/animations/eda';

  export const EDA_ANIMATION_FILES = [
    'eda_standing.json',
    'eda_fidgeting.json',
    'eda_bored.json',
    'eda_waving.json',
    'eda_jumping.json'
  ] as const;

  export type AnimationName = typeof EDA_ANIMATION_FILES[number];

  export const transformAnimationData = (data: any): Animation => {
    return {
      ...data,
      fr: parseFloat(data.fr),
      ip: parseFloat(data.ip),
      op: parseFloat(data.op),
      w: parseFloat(data.w),
      h: parseFloat(data.h),
      assets: data.assets.map((asset: any) => ({
        ...asset,
        w: parseFloat(asset.w),
        h: parseFloat(asset.h)
      })),
      layers: data.layers.map((layer: any) => ({
        ...layer,
        ip: parseFloat(layer.ip),
        op: parseFloat(layer.op),
      }))
    };
  };
