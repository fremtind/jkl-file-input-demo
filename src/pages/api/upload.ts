import formidable from "formidable";
import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs/promises";

export const config = {
	api: {
		bodyParser: false,
	},
};

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	if (req.method !== "POST") {
		return res.status(400);
	}

	const form = formidable({
		keepExtensions: true,
	});
	await new Promise((resolve) => {
		form.parse(req, async function (err, fields, { file }) {
			if (err) {
				console.error(err);
				return resolve(res.status(500).send(""));
			}
			const files = Array.isArray(file) ? file : [file];
			for (const f of files) {
				try {
					const data = await fs.readFile(f.filepath);
					await fs.writeFile(`./public/uploads/${f.originalFilename}`, data);
					await fs.unlink(f.filepath);
				} catch (e) {
					console.error(e);
					return resolve(res.status(500).send(""));
				}
			}
			return resolve(
				res.status(201).send(
					files.map((f) => ({
						publicPath: `./uploads/${f.originalFilename}`,
						name: f.originalFilename,
						type: f.mimetype,
						size: f.size,
					}))
				)
			);
		});
	});
}
