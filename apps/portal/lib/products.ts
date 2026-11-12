export type ProductStatus = 'Active' | 'Pending' | 'Draft';
export type ThumbnailType = 
  | 'shirt' 
  | 'sneaker' 
  | 'tee' 
  | 'top' 
  | 'sweat' 
  | 'tank' 
  | 'bag' 
  | 'vest' 
  | 'blazer';

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: string;
  price: string;
  status: ProductStatus;
  thumb: ThumbnailType;
  thumbnailUrl?: string | null;
}
