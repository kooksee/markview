interface MindmapToggleProps {
    isMindmapOpen: boolean;
    onToggle: () => void;
}

export function MindmapToggle({ isMindmapOpen, onToggle }: MindmapToggleProps) {
    return (
        <button
            type="button"
            className="flex items-center justify-center bg-transparent border border-gh-border rounded-md p-1.5 text-gh-text-secondary cursor-pointer transition-colors duration-150 hover:bg-gh-bg-hover"
            onClick={onToggle}
            aria-label="Mindmap"
            aria-expanded={isMindmapOpen}
            title={isMindmapOpen ? "Hide mindmap" : "Show mindmap"}
        >
            <svg
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
            >
                <circle cx="12" cy="6" r="2.5" />
                <circle cx="6" cy="18" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.2 7.9 7.7 15.3m6.1-7.4 2.5 7.4M8.3 17.4h7.4" />
            </svg>
        </button>
    );
}
