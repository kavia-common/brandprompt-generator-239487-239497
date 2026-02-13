import { generatePrompt, resolveBaseUrl } from "./apiClient";

function mockFetchOnce(impl) {
  global.fetch = jest.fn(impl);
}

describe("apiClient", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  test("resolveBaseUrl trims trailing slash", () => {
    expect(resolveBaseUrl({ backendBaseUrl: "http://x:3001/" })).toBe("http://x:3001");
  });

  test("generatePrompt throws if brandName missing", async () => {
    await expect(generatePrompt("http://localhost:3001", { topic: "Hello" })).rejects.toThrow(
      /Brand name is required/i
    );
  });

  test("generatePrompt throws if topic/context missing", async () => {
    await expect(
      generatePrompt("http://localhost:3001", { brandName: "Acme", topic: "   ", context: "" })
    ).rejects.toThrow(/Topic .* required/i);
  });

  test("generatePrompt maps UI fields into backend schema and posts to /prompts/generate", async () => {
    mockFetchOnce(async (url, opts) => {
      const body = JSON.parse(opts.body);

      expect(url).toBe("http://api.test/prompts/generate");
      expect(opts.method).toBe("POST");
      expect(body.orientation).toBe("landing_page"); // mapping
      expect(body.platform).toBe("x"); // "X (Twitter)" -> x
      expect(body.brief).toBe("Topic here");
      expect(body.brand.brand_name).toBe("Acme");
      expect(body.brand.voice.avoid).toEqual(["Avoid emojis."]);
      expect(body.brand.voice.keywords).toEqual(["one", "two"]);
      expect(body.style.formatting_notes).toBe("Do guidance");

      return {
        ok: true,
        status: 200,
        json: async () => ({ prompt: "PROMPT", metadata: { orientation: "landing_page" } }),
        text: async () => "",
      };
    });

    const res = await generatePrompt("http://api.test", {
      brandName: "Acme",
      topic: "Topic here",
      context: "Extra context",
      orientation: "Landing Page",
      platform: "X (Twitter)",
      audience: "Founders",
      brandDont: "Avoid emojis.",
      brandDo: "Do guidance",
      keywords: "one, two",
    });

    expect(res.prompt).toBe("PROMPT");
    expect(res.metadata.orientation).toBe("landing_page");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("generatePrompt throws HttpError on non-2xx response and includes bodyText", async () => {
    mockFetchOnce(async () => ({
      ok: false,
      status: 500,
      text: async () => "server down",
      json: async () => null,
    }));

    await expect(
      generatePrompt("http://api.test", { brandName: "Acme", topic: "Hi" })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/Generate failed \(500\)/),
      status: 500,
      bodyText: "server down",
    });
  });
});
