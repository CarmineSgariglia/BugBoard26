/*
  Shared application background used by the main authenticated shell.
*/

export function AppBackground() {
    return (
        <div
            className="pointer-events-none fixed inset-0 z-0 bg-[#11131A]"
            style={{
                background: "radial-gradient(circle at center, #343B54 0%, #11131A 62%)"
            }}
        />
    );
}
