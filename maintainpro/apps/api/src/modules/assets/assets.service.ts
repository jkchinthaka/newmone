import { randomUUID } from "node:crypto";

import { cloudinary } from "../../config/cloudinary";

export interface AssetRecord {
  id: string;
  code: string;
  name: string;
  location: string;
  status: "active" | "inactive" | "maintenance";
  imageUrl?: string;
}

const assets: AssetRecord[] = [
  {
    id: "asset-001",
    code: "PUMP-101",
    name: "Primary Cooling Pump",
    location: "Plant A - Utility Room",
    status: "active"
  },
  {
    id: "asset-002",
    code: "AHU-220",
    name: "Air Handling Unit",
    location: "Building 2 - Roof",
    status: "maintenance"
  }
];

const uploadToCloudinary = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "maintainpro/assets",
        public_id: fileName.replace(/\.[^.]+$/, "")
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve(result.secure_url);
      }
    );

    stream.end(fileBuffer);
  });
};

export const assetsService = {
  listAssets(): AssetRecord[] {
    return assets;
  },

  createAsset(input: Omit<AssetRecord, "id">): AssetRecord {
    const created: AssetRecord = {
      id: randomUUID(),
      ...input
    };

    assets.push(created);
    return created;
  },

  async uploadAssetImage(fileBuffer: Buffer, fileName: string): Promise<string> {
    try {
      return await uploadToCloudinary(fileBuffer, fileName);
    } catch {
      return `local://uploads/${Date.now()}-${fileName}`;
    }
  }
};
