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
}

export const PRODUCTS_DATA: Product[] = [
  { id: '1', name: 'Cotton Man Shirt', category: 'Shirt', stock: '43', price: '$245', status: 'Active', thumb: 'shirt' },
  { id: '2', name: 'Retoro Multi Sneakers', category: 'Shoe', stock: '134', price: '$264', status: 'Pending', thumb: 'sneaker' },
  { id: '3', name: 'Cotton Man Shirt', category: 'Polo', stock: '535', price: '$364', status: 'Active', thumb: 'tee' },
  { id: '4', name: 'Open Back Top', category: 'Top', stock: '643', price: '$163', status: 'Draft', thumb: 'top' },
  { id: '5', name: 'Polo Sweat Shirt', category: 'Polo', stock: '754', price: '$234', status: 'Active', thumb: 'sweat' },
  { id: '6', name: 'Cotton knitwear', category: 'Knitwear', stock: '743', price: '$134', status: 'Active', thumb: 'tank' },
  { id: '7', name: 'Bag with compartme', category: 'Bag', stock: '664', price: '$422', status: 'Draft', thumb: 'bag' },
  { id: '8', name: 'Tailored blend waistcoat', category: 'Waistcoat', stock: '34', price: '$165', status: 'Pending', thumb: 'vest' },
  { id: '9', name: 'Linen Blend Blazer', category: 'Co-Ord Set', stock: '643', price: '$235', status: 'Active', thumb: 'blazer' },
];
