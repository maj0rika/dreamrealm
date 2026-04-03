interface LocationBadgeProps {
    locationName: string;
}

export function LocationBadge({ locationName }: LocationBadgeProps) {
    return (
        <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-sm text-white backdrop-blur-sm">
            <span>📍</span>
            <span>{locationName}</span>
        </div>
    );
}
