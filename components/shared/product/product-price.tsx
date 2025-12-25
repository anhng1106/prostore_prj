import { cn } from "@/lib/utils";

const ProductPrice = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => {
  //ensure to decimal places
  const stringValue = value.toFixed(2);

  //get the int/float
  const [intValue, floatValue] = stringValue.split(".");

  return (
    <p className={cn("text-2xl", className)}>
      <span className="text-xs font-bold align-super">$</span>
      {intValue}
      <span className="text-xs font-bold align-super">{floatValue}</span>
    </p>
  );
};

export default ProductPrice;
