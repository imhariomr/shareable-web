import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useState } from "react";

interface props{
 mainContent: string,
 toolTipContent: string,
 className: string,
 useButton: boolean,
 disabled?:any,
 setCopyToClipboard?: () => void,
 onMouseLeave?: () => void;
 onClick?:() => void
}



export function ShowTooltipInContent({mainContent,toolTipContent,className,useButton,setCopyToClipboard,onMouseLeave,disabled,onClick}: props) {

  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(mainContent);
    setIsCopied(true);
    setCopyToClipboard?.();
  }

  const cssClass = `${className} ${disabled ? 'cursor-not-allowed opacity-30' : ''}`;

  const content = useButton
    ? <Button variant="outline" onClick={onClick}>{mainContent}</Button>
    : <div className={cssClass} onClick={onClick}>{mainContent}</div>;

  if (!toolTipContent?.trim()) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {content}
      </TooltipTrigger>

      <TooltipContent>
        <p onClick={handleCopy} onMouseLeave={onMouseLeave}>
          {toolTipContent}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

