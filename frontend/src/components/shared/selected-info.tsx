import React from "react";
import { Card } from "../ui/card";

type SelectedInfoProps = {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
};

export const SelectedInfo: React.FC<SelectedInfoProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <Card className="p-4 bg-muted/30">
      <div className="font-semibold mb-1 text-foreground">{title}</div>
      {subtitle && (
        <div className="text-muted-foreground text-sm">{subtitle}</div>
      )}
      {children}
    </Card>
  );
};
