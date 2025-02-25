const BUNNY_API_KEY = import.meta.env.VITE_BUNNY_API_KEY;
const BUNNY_API_URL = "https://video.bunnycdn.com/library";

interface BunnyVideoResponse {
  guid: string;
  title: string;
}

export const uploadVideo = async (
  file: File,
  libraryId: string,
): Promise<BunnyVideoResponse> => {
  try {
    // First create the video in Bunny.net
    const createResponse = await fetch(`${BUNNY_API_URL}/${libraryId}/videos`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        AccessKey: BUNNY_API_KEY,
      },
      body: JSON.stringify({
        title: file.name,
      }),
    });

    if (!createResponse.ok) {
      throw new Error("Failed to create video");
    }

    const videoData = await createResponse.json();

    // Then upload the actual video file
    const uploadResponse = await fetch(
      `${BUNNY_API_URL}/${libraryId}/videos/${videoData.guid}`,
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          AccessKey: BUNNY_API_KEY,
        },
        body: file,
      },
    );

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload video");
    }

    return videoData;
  } catch (error) {
    console.error("Error uploading video:", error);
    throw error;
  }
};
