/** Device-local keyed value. Never exported in project packages or synchronized. */
export interface DeviceSetting {
    key: string;
    value: unknown;
    updatedAt: string;
}
