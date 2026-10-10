import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

const ALL_VALUE = "__memory_all__";

/** Present the existing memory values with the application's shared selection control. */
export function MemorySelect({id, label, value, onValueChange, options, emptyLabel, disabled}: {
    id?: string;
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    options: Record<string, string>;
    emptyLabel?: string;
    disabled?: boolean;
}) {
    return <Select value={value || ALL_VALUE}
                   onValueChange={next => onValueChange(next === ALL_VALUE ? "" : next)} disabled={disabled}>
        <SelectTrigger id={id} aria-label={label} className="memory-select"><SelectValue/></SelectTrigger>
        <SelectContent>
            {emptyLabel && <SelectItem value={ALL_VALUE}>{emptyLabel}</SelectItem>}
            {Object.entries(options).map(([option, text]) => <SelectItem key={option} value={option}>{text}</SelectItem>)}
        </SelectContent>
    </Select>;
}
