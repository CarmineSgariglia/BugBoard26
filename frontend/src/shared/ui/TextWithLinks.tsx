import React from "react";
import { FiGlobe } from "react-icons/fi";

export function TextWithLinks({ text, className = "" }: { text: string; className?: string }) {
    if (!text) return null;

    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/g;

    const parts = text.split(urlRegex);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.match(urlRegex)) {
                    // Garantiamo il protocollo se l'utente ha scritto solo "www..." 
                    // altrimenti il browser penserà sia un link interno (es. localhost:3000/www.sito.it)
                    const href = part.startsWith("www.") ? `https://${part}` : part;

                    return (
                        <a
                            key={index}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5671F6] hover:text-[#7f95fb] hover:underline break-words inline-flex items-center gap-1 bg-gray-500/20 rounded-md px-1 border-2 border-gray-500/20"
                        >
                            <FiGlobe size={14} className="flex-shrink-0" />
                            <span>{part}</span>
                        </a>
                    );
                }
                return <React.Fragment key={index}>{part}</React.Fragment>;
            })}
        </span>
    );
}
