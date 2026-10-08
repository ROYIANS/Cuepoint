import {BookOpen} from "lucide-react";
import type {MemorySourceRef} from "@/domain/projectMemory";
import {Button} from "@/components/ui/button";

export function MemoryPromotion({
                                    source,
                                    pending,
                                    disabled,
                                    onPromote,
                                }: {
    source: MemorySourceRef;
    pending: boolean;
    disabled: boolean;
    onPromote: (source: MemorySourceRef) => void;
}) {
    return (
        <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onPromote(source)}
        >
            <BookOpen size={14}/>
            {pending ? "读取来源…" : "存为项目记忆"}
        </Button>
    );
}
