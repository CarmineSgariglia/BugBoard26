{/* 
    The AppBackground component is a reusable component that is used to display the background of the application.
    It is used in the MainLayout component to display the background of the application.
*/}


export function AppBackground() {
    return (
        <div
            className="pointer-events-none fixed inset-0 z-0 bg-[#0D0D12]"
            style={{
                background: "radial-gradient(circle at center, #2b3044ff 0%, #0d0d12 60%)"
            }}
        />
    );
}
