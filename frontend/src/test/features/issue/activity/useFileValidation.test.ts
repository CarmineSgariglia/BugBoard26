import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFileValidation } from "../../../../features/issue/lib/useFileValidation";
import { prepareAttachmentUpload } from "@shared/lib/media";

// Mock @shared/lib/media
vi.mock("@shared/lib/media", () => ({
  prepareAttachmentUpload: vi.fn(),
}));

describe("useFileValidation", () => {
  const dummyFile1 = new File(["content1"], "file1.txt", { type: "text/plain" });
  const dummyFile2 = new File(["content2"], "file2.jpg", { type: "image/jpeg" });

  it("adds valid files updating the files state list", async () => {
    vi.mocked(prepareAttachmentUpload).mockImplementation(async (file) => file);

    const { result } = renderHook(() => useFileValidation());

    await act(async () => {
      await result.current.handleFiles([dummyFile1, dummyFile2]);
    });

    expect(result.current.files).toHaveLength(2);
    expect(result.current.files[0].name).toBe("file1.txt");
    expect(result.current.error).toBeNull();
  });

  it("discards files exceeding maxFiles and triggers a size error", async () => {
    vi.mocked(prepareAttachmentUpload).mockImplementation(async (file) => file);

    const { result } = renderHook(() => useFileValidation({ maxFiles: 1 }));

    await act(async () => {
      await result.current.handleFiles([dummyFile1, dummyFile2]);
    });

    // Only 1 file should be accepted
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("file1.txt");

    // Limits message warning
    expect(result.current.error).toContain("Max 1 files allowed");
  });

  it("handles catch errors in prepareAttachmentUpload and appends messages to state Error", async () => {
    vi.mocked(prepareAttachmentUpload)
      .mockResolvedValueOnce(dummyFile1) // first succeeds
      .mockRejectedValueOnce(new Error("File too corrupted")); // second fails

    const { result } = renderHook(() => useFileValidation());

    await act(async () => {
      await result.current.handleFiles([dummyFile1, dummyFile2]);
    });

    // Only the first file is accepted
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("file1.txt");

    // Contains error trace
    expect(result.current.error).toBe("File too corrupted");
  });

  it("removes correctly a file by index positions", async () => {
    vi.mocked(prepareAttachmentUpload).mockImplementation(async (file) => file);

    const { result } = renderHook(() => useFileValidation());

    await act(async () => {
      await result.current.handleFiles([dummyFile1, dummyFile2]);
    });

    expect(result.current.files).toHaveLength(2);

    act(() => {
      result.current.removeFile(0); // removes dummyFile1
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].name).toBe("file2.jpg");
  });

  it("resets files empty array and clears error structures", async () => {
    vi.mocked(prepareAttachmentUpload)
      .mockResolvedValueOnce(dummyFile1)
      .mockRejectedValueOnce(new Error("Broken file"));

    const { result } = renderHook(() => useFileValidation());

    await act(async () => {
      await result.current.handleFiles([dummyFile1, dummyFile2]);
    });

    expect(result.current.files).toHaveLength(1);
    expect(result.current.error).toBe("Broken file");

    act(() => {
      result.current.resetFiles();
    });

    expect(result.current.files).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });
});
