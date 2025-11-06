/**
 * Simple wrapper for tw-react-components
 * If tw-react-components is not available, this provides basic components
 * styled with Tailwind CSS classes
 */
import React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  size?: "small" | "medium" | "large";
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "medium",
  className = "",
  disabled = false,
  ...props
}) => {
  const baseClasses =
    "px-4 py-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary:
      "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };
  const sizeClasses = {
    small: "px-2 py-1 text-sm",
    medium: "px-4 py-2",
    large: "px-6 py-3 text-lg",
  };
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      className={`${baseClasses} ${
        variantClasses[variant as keyof typeof variantClasses]
      } ${
        sizeClasses[size as keyof typeof sizeClasses]
      } ${disabledClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
};

export const Input: React.FC<InputProps> = ({ className = "", ...props }) => {
  return (
    <input
      className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
      {...props}
    />
  );
};

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
};

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: React.ReactNode;
  className?: string;
};

export const Select: React.FC<SelectProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <select
      className={`px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  type?: "info" | "error" | "success" | "warning";
  className?: string;
};

export const Alert: React.FC<AlertProps> = ({
  children,
  type = "info",
  className = "",
  ...props
}) => {
  const typeClasses = {
    info: "bg-blue-50 text-blue-800 border-blue-200",
    error: "bg-red-50 text-red-800 border-red-200",
    success: "bg-green-50 text-green-800 border-green-200",
    warning: "bg-yellow-50 text-yellow-800 border-yellow-200",
  };

  return (
    <div
      className={`px-4 py-3 rounded-md border ${
        typeClasses[type as keyof typeof typeClasses]
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  children: React.ReactNode;
  className?: string;
};

export const Table: React.FC<TableProps> = ({
  children,
  className = "",
  ...props
}) => {
  return (
    <table
      className={`min-w-full divide-y divide-gray-200 ${className}`}
      {...props}
    >
      {children}
    </table>
  );
};
