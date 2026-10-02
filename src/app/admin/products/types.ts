export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice?: number;
  images: string[];
  ingredients: string[];
  benefits: string[];
  usage: string;
  stock: number;
  lowStockThreshold?: number;
  archivedAt?: string;
  sku?: string;
  weight?: number;
  gst?: number;
  isFeatured: boolean;
  isActive: boolean;
  category?: string;
  tags?: string[];
  variants?: { _id: string; name: string; sku?: string; price: number; discountPrice?: number; stock: number; isActive: boolean }[];
}
