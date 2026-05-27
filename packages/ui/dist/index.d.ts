import * as class_variance_authority_types from 'class-variance-authority/types';
import React from 'react';
import { VariantProps } from 'class-variance-authority';
import * as react_jsx_runtime from 'react/jsx-runtime';
import { Product } from '@ecowoods/types';

declare const buttonVariants: (props?: ({
    variant?: "primary" | "outline" | "ghost" | null | undefined;
    size?: "default" | "lg" | "xl" | null | undefined;
} & class_variance_authority_types.ClassProp) | undefined) => string;
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}
declare const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

declare const JobCard: ({ job }: any) => react_jsx_runtime.JSX.Element;

interface ProductCardProps {
    product: Product;
}
declare const ProductCard: ({ product }: ProductCardProps) => react_jsx_runtime.JSX.Element;

export { Button, JobCard, ProductCard };
