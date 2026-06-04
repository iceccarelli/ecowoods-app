import React from 'react';
import { Product } from '@ecowoods/types';

interface ProductCardProps {
    product: Product;
}
declare const ProductCard: ({ product }: ProductCardProps) => React.JSX.Element;

export { ProductCard };
