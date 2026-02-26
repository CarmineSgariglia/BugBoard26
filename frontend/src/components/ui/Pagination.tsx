import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

export function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange
}: PaginationProps) {
    if (totalItems <= 0) return null;

    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="px-8 py-5 bg-[#14161B] flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5">
            <span className="text-xs text-neutral-500 font-medium tracking-wide">
                Showing <span className="text-white font-bold">{startItem}</span> to <span className="text-white font-bold">{endItem}</span> of <span className="text-white font-bold">{totalItems}</span> items
            </span>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-neutral-400 transition-all font-bold text-sm"
                >
                    <FiChevronLeft size={16} />
                </button>

                {/* Page Numbers */}
                {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                        key={i}
                        onClick={() => onPageChange(i + 1)}
                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all font-bold text-sm ${currentPage === i + 1 ? 'bg-[#4A72FF] text-white shadow-lg shadow-[#4A72FF]/20' : 'bg-transparent text-neutral-400 hover:text-white hover:bg-white/5'}`}
                    >
                        {i + 1}
                    </button>
                ))}

                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-neutral-400 transition-all font-bold text-sm"
                >
                    <FiChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
