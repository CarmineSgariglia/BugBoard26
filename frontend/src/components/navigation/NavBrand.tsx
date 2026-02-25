import { Link } from "react-router-dom";
import brandLogo from "../../assets/LogoBugBoard26.webp";

export function NavBrand() {
    return (
        <Link to="/projects" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={brandLogo} alt="Logo_BugBoard26" className="w-8 h-8" />
            <span className="text-white text-lg font-bold tracking-wide">Projects</span>
        </Link>
    );
}
