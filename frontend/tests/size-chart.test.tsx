import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { SizeChartEditor } from "../src/features/provider-dashboard/size-chart/SizeChartEditor";
import { sizeChartApi } from "../src/features/provider-dashboard/size-chart/sizeChartApi";
import {
  cleanChart,
  parseLength,
  parseRange,
  rawRows,
  serializeRows,
} from "../src/features/provider-dashboard/size-chart/sizeChartHelpers";
import type { Chart } from "../src/features/provider-dashboard/size-chart/sizeChartApi";
vi.mock(
  "../src/features/provider-dashboard/size-chart/sizeChartApi",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../src/features/provider-dashboard/size-chart/sizeChartApi")
    >()),
    sizeChartApi: {
      get: vi.fn(),
      save: vi.fn(),
      confirm: vi.fn(),
      upload: vi.fn(),
    },
  }),
);
const chart: Chart = {
  version: 1,
  sourceRevision: 1,
  source: "MANUAL",
  status: "CONFIRMED",
  measurementType: "BODY",
  lengthUnit: "CM",
  weightUnit: "KG",
  requiredMeasurements: ["chest"],
  rows: [{ size: "M", chest: { min: 86, max: 89 } }],
};
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(sizeChartApi.get).mockResolvedValue({
    version: 1,
    sizes: ["M"],
    sizeChart: chart,
  });
});
describe("size chart parsing and serialization", () => {
  it.each([
    ["86..89", { min: 86, max: 89 }],
    ["86–89", { min: 86, max: 89 }],
    ["86,5..89,5", { min: 86.5, max: 89.5 }],
    ["-2..2", { min: -2, max: 2 }],
  ])("parses %s", (text, result) =>
    expect(parseRange(text as string)).toEqual(result),
  );
  it("rejects malformed/reversed ranges and zero body measurements", () => {
    expect(() => parseRange("89..86")).toThrow();
    expect(() => parseRange("86..86")).toThrow();
    expect(() => parseRange("86")).toThrow();
    expect(() => parseRange("many")).toThrow();
    expect(() =>
      serializeRows([{ ...rawRows(["M"])[0], chest: "0..1" }]),
    ).toThrow();
  });
  it("stores one exact garment length while keeping body measurements as ranges", () => {
    expect(parseLength("138")).toEqual({ min: 138, max: 138 });
    expect(parseLength("138..140")).toEqual({ min: 138, max: 140 });
    expect(serializeRows([{ ...rawRows(["S"])[0], length: "138" }])).toEqual([
      { size: "S", length: { min: 138, max: 138 } },
    ]);
    expect(() => parseRange("138")).toThrow();
  });
  it("never sends confirmation metadata back to the save endpoint", () => {
    expect(cleanChart(chart)).not.toHaveProperty("status");
    expect(cleanChart(chart)).not.toHaveProperty("version");
  });
});
describe("provider chart editor", () => {
  it("explains that a confirmed chart is unusable after product sizes change", async () => {
    vi.mocked(sizeChartApi.get).mockResolvedValue({
      version: 1,
      sizes: ["M", "L"],
      sizeChart: chart,
      ready: false,
    });
    const { container } = render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "L Ngực từ" });
    expect(container.querySelector(".size-chart-status")?.textContent).toContain("không còn phù hợp với các size hiện tại");
    expect((screen.getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps unsaved measurement edits when an image is selected", async () => {
    vi.mocked(sizeChartApi.get).mockResolvedValue({
      version: 1,
      sizes: ["M"],
      sizeChart: { ...chart, source: "IMAGE", imageUrl: "https://example.com/old.png" },
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    const from = await screen.findByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement;
    fireEvent.change(from, { target: { value: "87" } });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "new.png", { type: "image/png" })] },
    });
    expect(sizeChartApi.upload).not.toHaveBeenCalled();
    expect(from.value).toBe("87");
    expect(screen.getByRole("alert").textContent).toContain("thay đổi chưa lưu");
    expect(screen.getByRole("status").textContent).toContain("bảng đã xác nhận trước đó vẫn được giữ nguyên");
  });
  it("lets the provider add optional shoulder and upper-arm ranges without changing the six main fields", async () => {
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.click(screen.getByText("Vai và bắp tay (tùy chọn)"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "M Ngang vai từ" }), { target: { value: "38" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "M Ngang vai đến" }), { target: { value: "40" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "M Vòng bắp tay từ" }), { target: { value: "27" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "M Vòng bắp tay đến" }), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bảng nháp" }));
    await waitFor(() => expect(sizeChartApi.save).toHaveBeenCalledWith("p", 1, expect.objectContaining({
      rows: [{ size: "M", chest: { min: 86, max: 89 }, shoulder: { min: 38, max: 40 }, bicep: { min: 27, max: 30 } }],
    })));
  });
  it("loads chart, invalidates local confirmation on edit, and requires save before confirm", async () => {
    const pending = vi.fn();
    render(<SizeChartEditor productId="p" onPendingChange={pending} />);
    const from = await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    const to = screen.getByRole("spinbutton", { name: "M Ngực đến" });
    expect((from as HTMLInputElement).value).toBe("86");
    expect((to as HTMLInputElement).value).toBe("89");
    fireEvent.change(from, { target: { value: "87" } });
    fireEvent.change(to, { target: { value: "90" } });
    await waitFor(() => expect(pending).toHaveBeenLastCalledWith(true));
    expect(
      (
        screen.getByRole("button", {
          name: "Tôi đã kiểm tra — xác nhận bảng size",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    vi.mocked(sizeChartApi.save).mockResolvedValue({
      version: 2,
      sizeChart: {
        ...chart,
        status: "DRAFT",
        version: 2,
        rows: [{ size: "M", chest: { min: 87, max: 90 } }],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bảng nháp" }));
    await waitFor(() =>
      expect(sizeChartApi.save).toHaveBeenCalledWith(
        "p",
        1,
        expect.objectContaining({
          rows: [{ size: "M", chest: { min: 87, max: 90 } }],
        }),
      ),
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Tôi đã kiểm tra — xác nhận bảng size",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    vi.mocked(sizeChartApi.confirm).mockResolvedValue({
      version: 3,
      sizeChart: { ...chart, version: 3 },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tôi đã kiểm tra — xác nhận bảng size",
      }),
    );
    await waitFor(() =>
      expect(sizeChartApi.confirm).toHaveBeenCalledWith("p", 2),
    );
  });
  it("surfaces permission/load errors and blocks editing", async () => {
    vi.mocked(sizeChartApi.get).mockRejectedValue(new Error("Không có quyền"));
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Không có quyền",
    );
    expect(sizeChartApi.save).not.toHaveBeenCalled();
  });
  it("uploads a chart image for extraction and waits for provider confirmation", async () => {
    vi.mocked(sizeChartApi.upload).mockResolvedValue({
      version: 2,
      sizeChart: {
        ...chart,
        source: "IMAGE",
        imageUrl: "https://example.com/chart.png",
        status: "DRAFT",
        version: 2,
        rows: [{ size: "M", chest: { min: 90, max: 94 }, length: { min: 138, max: 138 } }],
      },
      sizes: ["M"],
      warnings: ["Kiểm tra số đo trích xuất từ ảnh"],
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText("Nguồn bảng"), { target: { value: "IMAGE" } });
    const fileInput = screen.getByLabelText(/Tải ảnh bảng size/) as HTMLInputElement;
    const clickFileInput = vi.spyOn(fileInput, "click");
    fireEvent.click(screen.getByRole("button", { name: /Chọn ảnh bảng size/ }));
    expect(clickFileInput).toHaveBeenCalledOnce();
    fireEvent.change(fileInput, {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(sizeChartApi.upload).toHaveBeenCalledWith("p", 1, expect.any(File), expect.objectContaining({ source: "IMAGE" })));
    expect(await screen.findByText("Kiểm tra số đo trích xuất từ ảnh")).toBeTruthy();
    expect(sizeChartApi.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Chưa xác nhận");
    expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("90");
    expect((screen.getByRole("spinbutton", { name: "M Ngực đến" }) as HTMLInputElement).value).toBe("94");
    expect((screen.getByRole("spinbutton", { name: "M Dài áo" }) as HTMLInputElement).value).toBe("138");
    expect((screen.getByRole("checkbox", { name: "Ngực" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByRole("spinbutton", { name: "M Ngực đến" }), {
      target: { value: "95" },
    });
    expect((screen.getByRole("spinbutton", { name: "M Ngực đến" }) as HTMLInputElement).value).toBe("95");
    expect(screen.getByRole("link", { name: /Xem ảnh đã tải/ }).getAttribute("href")).toBe("https://example.com/chart.png");
    expect(screen.getByRole("button", { name: /Chọn ảnh khác/ })).toBeTruthy();
  });
  it("shows OCR rows when product sizes arrive with the upload response", async () => {
    vi.mocked(sizeChartApi.get).mockResolvedValue({
      version: 1,
      sizes: [],
      sizeChart: null,
    });
    vi.mocked(sizeChartApi.upload).mockResolvedValue({
      version: 3,
      sizes: ["M", "L"],
      sizeChart: {
        ...chart,
        source: "IMAGE",
        imageUrl: "https://example.com/chart.png",
        status: "DRAFT",
        version: 3,
        rows: [
          { size: "M", chest: { min: 84, max: 88 } },
          { size: "L", chest: { min: 88, max: 92 } },
        ],
      },
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Sản phẩm chưa có size");
    fireEvent.change(screen.getByLabelText("Nguồn bảng"), { target: { value: "IMAGE" } });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("84"));
    expect((screen.getByRole("spinbutton", { name: "L Ngực đến" }) as HTMLInputElement).value).toBe("92");
    expect((screen.getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("re-reads persisted OCR rows when the upload response has no visible rows", async () => {
    vi.mocked(sizeChartApi.get)
      .mockResolvedValueOnce({ version: 0, sizes: ["M"], sizeChart: null })
      .mockResolvedValueOnce({ version: 0, sizes: ["M"], sizeChart: null })
      .mockResolvedValueOnce({
        version: 2,
        sizes: ["M"],
        sizeChart: {
          ...chart,
          source: "IMAGE",
          imageUrl: "https://example.com/chart.png",
          status: "DRAFT",
          version: 2,
          rows: [{ size: "M", chest: { min: 84, max: 88 } }],
        },
      });
    vi.mocked(sizeChartApi.upload).mockResolvedValue({
      version: 2,
      sizes: ["M"],
      sizeChart: {
        ...chart,
        source: "IMAGE",
        imageUrl: "https://example.com/chart.png",
        status: "DRAFT",
        version: 2,
        rows: [],
      },
      extractionFailed: false,
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText("Nguồn bảng"), { target: { value: "IMAGE" } });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("84"));
    expect(screen.getByText("Đã có 1 dòng size để kiểm tra và chỉnh sửa.")).toBeTruthy();
    expect(sizeChartApi.get).toHaveBeenCalledTimes(3);
  });
  it("refreshes a stale chart before upload without spending an AI call", async () => {
    const imageChart = { ...chart, source: "IMAGE" as const, imageUrl: "https://example.com/chart.png" };
    vi.mocked(sizeChartApi.get)
      .mockResolvedValueOnce({ version: 1, sizes: ["M"], sizeChart: imageChart })
      .mockResolvedValueOnce({
        version: 2,
        sizes: ["M"],
        sizeChart: { ...imageChart, version: 2, status: "DRAFT", rows: [{ size: "M", chest: { min: 90, max: 94 } }] },
      });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Bảng size đã thay đổi"));
    expect(sizeChartApi.upload).not.toHaveBeenCalled();
    expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("90");
  });
  it("does not retry a conflicting upload over a newer chart", async () => {
    const imageChart = { ...chart, source: "IMAGE" as const, imageUrl: "https://example.com/chart.png" };
    vi.mocked(sizeChartApi.get)
      .mockResolvedValueOnce({ version: 1, sizes: ["M"], sizeChart: imageChart })
      .mockResolvedValueOnce({ version: 1, sizes: ["M"], sizeChart: imageChart })
      .mockResolvedValueOnce({
        version: 2,
        sizes: ["M"],
        sizeChart: { ...imageChart, version: 2, status: "DRAFT", rows: [{ size: "M", chest: { min: 90, max: 94 } }] },
      });
    vi.mocked(sizeChartApi.upload).mockRejectedValue(new Error("Size chart changed; reload before uploading"));
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Bảng size đã thay đổi"));
    expect(sizeChartApi.upload).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("90");
  });
  it("still displays saved OCR rows when an older read response omits product sizes", async () => {
    vi.mocked(sizeChartApi.get).mockResolvedValue({
      version: 2,
      sizes: [],
      sizeChart: { ...chart, status: "DRAFT", source: "IMAGE", imageUrl: "https://example.com/chart.png" },
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("86"));
    expect((screen.getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("guides an existing image draft with no required measurements through save and confirmation", async () => {
    vi.mocked(sizeChartApi.get).mockResolvedValue({
      version: 2,
      sizes: ["M"],
      sizeChart: { ...chart, status: "DRAFT", source: "IMAGE", imageUrl: "https://example.com/chart.png", requiredMeasurements: [] },
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("86"));
    const confirm = await screen.findByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Hãy chọn ít nhất một vòng Ngực\/Eo\/Mông/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Ngực" }));
    vi.mocked(sizeChartApi.save).mockResolvedValue({
      version: 3,
      sizeChart: { ...chart, status: "DRAFT", source: "IMAGE", imageUrl: "https://example.com/chart.png", requiredMeasurements: ["chest"] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bảng nháp" }));
    await waitFor(() => expect(sizeChartApi.save).toHaveBeenCalledWith("p", 2, expect.objectContaining({ requiredMeasurements: ["chest"] })));
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(false));
    vi.mocked(sizeChartApi.confirm).mockResolvedValue({ version: 4, sizeChart: chart });
    fireEvent.click(confirm);
    await waitFor(() => expect(sizeChartApi.confirm).toHaveBeenCalledWith("p", 3));
  });
  it("keeps the draft editable when the confirmation API rejects it", async () => {
    vi.mocked(sizeChartApi.get).mockResolvedValue({
      version: 2,
      sizes: ["M"],
      sizeChart: { ...chart, status: "DRAFT" },
    });
    vi.mocked(sizeChartApi.confirm).mockRejectedValue(new Error("Bảng size chưa hợp lệ."));
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("86"));
    const confirm = await screen.findByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" });
    fireEvent.click(confirm);
    expect((await screen.findByRole("alert")).textContent).toContain("Bảng size chưa hợp lệ.");
    const from = screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement;
    fireEvent.change(from, { target: { value: "87" } });
    expect(from.value).toBe("87");
  });
  it("keeps an unreadable image editable and shows the extraction reason beside it", async () => {
    vi.mocked(sizeChartApi.upload).mockResolvedValue({
      version: 2,
      sizeChart: {
        ...chart,
        source: "IMAGE",
        imageUrl: "https://example.com/chart.png",
        status: "DRAFT",
        version: 2,
        rows: [],
      },
      sizes: ["M"],
      extractionFailed: true,
      warnings: ["Dịch vụ đọc ảnh chưa sẵn sàng. Ảnh đã lưu; hãy thử lại sau hoặc nhập tay."],
    });
    const { container } = render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText("Nguồn bảng"), { target: { value: "IMAGE" } });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(container.querySelector(".size-chart-image-footnote.is-error")?.textContent).toContain("Dịch vụ đọc ảnh chưa sẵn sàng"));
    expect(container.querySelector(".size-chart-extraction-hint")?.textContent).toContain("Chưa có số đo để tư vấn");
    expect(screen.getByRole("button", { name: /Thử lại với ảnh/ })).toBeTruthy();
    expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("button", { name: "Tôi đã kiểm tra — xác nhận bảng size" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps the previous measurements visible when replacing an image fails", async () => {
    const previous = {
      ...chart,
      source: "IMAGE" as const,
      imageUrl: "https://example.com/old.png",
      status: "DRAFT" as const,
    };
    vi.mocked(sizeChartApi.get).mockResolvedValue({ version: 1, sizes: ["M"], sizeChart: previous });
    vi.mocked(sizeChartApi.upload).mockResolvedValue({
      version: 1,
      sizes: ["M"],
      sizeChart: previous,
      extractionFailed: true,
      warnings: ["Gemini chưa xử lý được ảnh. Bảng cũ được giữ nguyên."],
    });
    const { container } = render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "new.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(container.querySelector(".size-chart-extraction-hint")?.textContent).toContain("Các số đo đã lưu trước đó vẫn còn"));
    expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("86");
    expect(screen.getByRole("link", { name: /Xem ảnh đã tải/ }).getAttribute("href")).toBe("https://example.com/old.png");
  });
  it("keeps image retry available after Gemini 503 without changing a confirmed manual chart", async () => {
    vi.mocked(sizeChartApi.upload).mockResolvedValue({
      version: 1,
      sizes: ["M"],
      sizeChart: chart,
      extractionFailed: true,
      warnings: ["Gemini trả 503. Ảnh mới chưa được lưu; bảng cũ được giữ nguyên."],
    });
    render(<SizeChartEditor productId="p" onPendingChange={vi.fn()} />);
    await screen.findByRole("spinbutton", { name: "M Ngực từ" });
    fireEvent.change(screen.getByLabelText("Nguồn bảng"), { target: { value: "IMAGE" } });
    fireEvent.change(screen.getByLabelText(/Tải ảnh bảng size/), {
      target: { files: [new File(["image"], "chart.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("bảng size cũ vẫn đã xác nhận"));
    expect((screen.getByLabelText("Nguồn bảng") as HTMLSelectElement).value).toBe("IMAGE");
    expect(screen.getByRole("button", { name: /Thử lại với ảnh/ })).toBeTruthy();
    expect((screen.getByRole("spinbutton", { name: "M Ngực từ" }) as HTMLInputElement).value).toBe("86");
    expect(screen.getByText(/Ảnh vừa chọn chưa được lưu/)).toBeTruthy();
    expect(sizeChartApi.save).not.toHaveBeenCalled();
  });
});
