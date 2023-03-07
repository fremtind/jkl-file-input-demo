import { initTabListener } from "@fremtind/jkl-core";
import { PrimaryButton } from "@fremtind/jkl-button-react";
import { type SupportLabelType } from "@fremtind/jkl-input-group-react";
import {
	FileInput,
	File,
	type FileInputFile,
	upload,
} from "@fremtind/jkl-file-input-react";
import { formatBytes } from "@fremtind/jkl-formatters-util";
import { ProgressBar } from "@fremtind/jkl-progress-bar-react";
import fs from "fs/promises";
import mime from "mime-types";
import Head from "next/head";
import { useState } from "react";
import styles from "@/styles/Home.module.scss";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";

initTabListener();

type FileType = {
	publicPath: string;
	name: string;
	type: string;
	size: number;
};

type Data = {
	files: FileType[];
};

export const getServerSideProps: GetServerSideProps<Data> = async () => {
	const dir = await fs.readdir(`./public/uploads/`);
	const paths: FileType[] = [];
	for (const entry of dir) {
		if (entry.endsWith(".gitkeep")) {
			continue;
		}
		const file = await fs.stat(`./public/uploads/${entry}`);
		paths.push({
			publicPath: `./uploads/${entry}`,
			name: entry.split("/").at(-1) || "ukjent",
			type: mime.lookup(entry) || "application/octet-stream",
			size: file.size,
		});
	}
	return {
		props: {
			files: paths,
		},
	};
};

export default function Home({
	files: filesFromLoader,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
	const [files, setFiles] = useState<FileType[]>(filesFromLoader);
	const [fileStates, setFileStates] = useState<FileInputFile[]>([]);

	const maxSizeBytes = 10_000_000;

	return (
		<>
			<Head>
				<title>Jøkul FileInput Demo</title>
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<link rel="icon" href="/favicon.ico" />
			</Head>
			<main className="jkl">
				<div className={styles.container}>
					<h1 className="jkl-title jkl-spacing-32--bottom">Filopplaster</h1>
					<FileInput
						legend="Vedlegg"
						labelProps={{ variant: "medium" }}
						className="jkl-spacing-16-24--bottom"
						accept="image/*,.pdf"
						maxSizeBytes={maxSizeBytes}
						value={fileStates}
						onChange={(e, newFiles) => {
							setFileStates((currentFiles) => [...currentFiles, ...newFiles]);
						}}
					>
						{fileStates.map(
							({ state, file, validation, uploadProgress }, index) => {
								let label: string | undefined = undefined;
								let labelType: SupportLabelType | undefined = undefined;

								const isUploading = state === "UPLOADING";

								if (validation?.type === "WRONG_TYPE") {
									labelType = "warning";
									label = `Filtypen ${
										file.name?.split(".")[1] || ""
									} støttes ikke`;
								} else if (state === "UPLOAD_SUCCESS") {
									labelType = "success";
									label = "Lastet opp";
								} else if (state === "UPLOAD_ERROR") {
									labelType = "error";
									label = "Filen lot seg ikke laste opp";
								} else if (validation?.type === "TOO_LARGE") {
									labelType = "error";
									label = `Filen er større enn ${formatBytes(
										maxSizeBytes
									)} og kan ikke lastes opp`;
								} else if (isUploading) {
									label = "Laster opp…";
								}

								return (
									<File
										key={file.name}
										fileName={file.name}
										fileType={file.type}
										fileSize={file.size}
										file={file}
										state={state}
										supportLabel={label}
										supportLabelType={labelType}
										onRemove={(e) => {
											setFileStates([
												...fileStates.slice(0, index),
												...fileStates.slice(index + 1),
											]);
										}}
									>
										{isUploading && (
											<ProgressBar aria-valuenow={uploadProgress} />
										)}
									</File>
								);
							}
						)}
					</FileInput>
					<PrimaryButton
						className="jkl-spacing-16--top"
						type="button"
						onClick={async () => {
							const promises = fileStates
								.filter(
									(fileState) => typeof fileState.validation === "undefined"
								)
								.map(async (fileState, i) => {
									setFileStates((state) => [
										...state.slice(0, i),
										{ ...state[i], state: "UPLOADING" },
										...state.slice(i + 1),
									]);

									const data = new FormData();
									data.append("file", fileState.file, fileState.file.name);

									try {
										const newFiles = await upload<FileType[]>(
											"http://localhost:3000/api/upload",
											data,
											(uploadProgress) => {
												setFileStates((state) => [
													...state.slice(0, i),
													{
														...state[i],
														uploadProgress,
													},
													...state.slice(i + 1),
												]);
											}
										);

										setFileStates((state) => [
											...state.slice(0, i),
											{ ...state[i], state: "UPLOAD_SUCCESS" },
											...state.slice(i + 1),
										]);
										setFiles((files) => [...files, ...newFiles]);
									} catch (e) {
										setFileStates((state) => [
											...state.slice(0, i),
											{ ...state[i], state: "UPLOAD_ERROR" },
											...state.slice(i + 1),
										]);
									}
								});

							await Promise.all(promises);
						}}
					>
						Last opp
					</PrimaryButton>
					{files.length > 0 ? (
						<>
							<h2 className="jkl-title jkl-spacing-32--top jkl-spacing-32--bottom">
								Filer du har delt med oss
							</h2>
							<ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
								{files.map((file) => (
									<li
										key={file.name}
										style={{ marginBottom: "var(--jkl-spacing-12)" }}
									>
										<File
											fileName={file.name}
											fileType={file.type}
											fileSize={file.size}
											path={file.publicPath}
										/>
									</li>
								))}
							</ul>
						</>
					) : null}
				</div>
			</main>
		</>
	);
}
