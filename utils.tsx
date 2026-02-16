import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { MediaEngineStore, SearchableSelect, useEffect, useState } from "@webpack/common";

import { settings } from "./settings";

interface PickerProps {
    streamMediaSelection: any[];
    streamMedia: any;
    settingKey: "streamMedia" | "streamMediaFallback";
}

const getDesktopSources = findByCodeLazy("desktop sources");
const configModule = findByPropsLazy("getOutputVolume");
const logger = new Logger("InstantScreenshare");

export async function getCurrentMedia() {
    const media = MediaEngineStore.getMediaEngine();
    const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

    if (settings.store.includeVideoDevices) {
        try {
            const videoDevices = Object.values(configModule.getVideoDevices() || {});
            const videoSources = videoDevices.map((device: any) => ({
                id: device.id,
                name: device.name,
                type: "video_device"
            }));
            sources.push(...videoSources);
        } catch (e) {
            logger.warn("Failed to get video devices:", e);
        }
    }

    if (settings.store.streamMedia && settings.store.streamMedia !== "") {
        const streamMedia = sources.find(screen => screen.id === settings.store.streamMedia);
        if (streamMedia) return streamMedia;
        logger.error(`Stream Media "${settings.store.streamMedia}" not found.`);
    }

    if (settings.store.streamMediaFallback && settings.store.streamMediaFallback !== "") {
        const fallbackMedia = sources.find(screen => screen.id === settings.store.streamMediaFallback);
        if (fallbackMedia) {
            logger.info("Falling back to configured fallback source.");
            return fallbackMedia;
        }
        logger.warn(`Fallback Stream Media "${settings.store.streamMediaFallback}" not found.`);
    }

    // Fallback to first available source
    logger.info("Resetting to first available source.");
    if (sources.length > 0) {
        settings.store.streamMedia = sources[0].id;
        return sources[0];
    }

    logger.error("No sources available!");
    throw new Error("No media sources available");
}

function StreamSimplePicker({ streamMediaSelection, streamMedia, settingKey }: PickerProps) {
    const options = [
        { label: "None", value: "", default: false },
        ...streamMediaSelection.map(screen => ({
            label: screen.name,
            value: screen.id,
            default: false,
        }))
    ];

    return (
        <SearchableSelect
            placeholder="Select a media source to stream "
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === (streamMedia || ""))}
            onChange={v => settings.store[settingKey] = v || ""}
            closeOnSelect
        />
    );
}

function ScreenSetting({ settingKey }: { settingKey: "streamMedia" | "streamMediaFallback" }) {
    const { includeVideoDevices } = settings.use(["includeVideoDevices"]);
    const streamMedia = settings.use([settingKey])[settingKey];
    const media = MediaEngineStore.getMediaEngine();
    const [streamMediaSelection, setStreamMediaSelection] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function fetchMedia() {
            setLoading(true);
            const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

            if (includeVideoDevices) {
                try {
                    const videoDevices = Object.values(configModule.getVideoDevices() || {});
                    const videoSources = videoDevices.map((device: any) => ({
                        id: device.id,
                        name: device.name,
                        type: "video_device"
                    }));
                    sources.push(...videoSources);
                } catch (e) {
                    logger.warn("Failed to get video devices:", e);
                }
            }

            if (active) {
                setStreamMediaSelection(sources);
                setLoading(false);
            }
        }
        fetchMedia();
        return () => { active = false; };
    }, [includeVideoDevices]);

    if (loading) return <Paragraph>Loading media sources...</Paragraph>;
    if (!streamMediaSelection.length) return <Paragraph>No Media found.</Paragraph>;

    return <StreamSimplePicker streamMediaSelection={streamMediaSelection} streamMedia={streamMedia} settingKey={settingKey} />;
}

export function SettingSection() {
    return (
        <section>
            <Heading>Primary streaming source</Heading>
            <Paragraph>Primary source to use for streaming</Paragraph>
            <ScreenSetting settingKey="streamMedia" />
        </section>
    );
}

export function FallbackSettingSection() {
    return (
        <section>
            <Heading>Fallback streaming source</Heading>
            <Paragraph>Used if the primary source is not available</Paragraph>
            <ScreenSetting settingKey="streamMediaFallback" />
        </section>
    );
}

export function getCurrentCamera() {
    try {
        const videoDevices = Object.values(configModule.getVideoDevices() || {});
        if (videoDevices.length === 0) {
            logger.warn("No video devices available.");
            return null;
        }

        if (settings.store.cameraDevice && settings.store.cameraDevice !== "") {
            const camera = videoDevices.find((device: any) => device.id === settings.store.cameraDevice);
            if (camera) return camera;
            logger.error(`Camera "${settings.store.cameraDevice}" not found.`);
        }

        if (settings.store.cameraDeviceFallback && settings.store.cameraDeviceFallback !== "") {
            const fallbackCamera = videoDevices.find((device: any) => device.id === settings.store.cameraDeviceFallback);
            if (fallbackCamera) {
                logger.info("Falling back to configured fallback camera.");
                return fallbackCamera;
            }
            logger.warn(`Fallback Camera "${settings.store.cameraDeviceFallback}" not found.`);
        }

        // Only fallback to first available camera if at least one setting is configured (not both "None")
        const hasPrimary = settings.store.cameraDevice && settings.store.cameraDevice !== "";
        const hasFallback = settings.store.cameraDeviceFallback && settings.store.cameraDeviceFallback !== "";

        if (!hasPrimary && !hasFallback) {
            // Both are "None" - don't enable camera
            return null;
        }

        // Fallback to first available camera if one of the settings was configured but device not found
        if (videoDevices.length > 0) {
            logger.info("Using first available camera.");
            return videoDevices[0] as any;
        }

        return null;
    } catch (e) {
        logger.warn("Failed to get video devices:", e);
        return null;
    }
}

interface CameraPickerProps {
    cameraSelection: any[];
    camera: any;
    settingKey: "cameraDevice" | "cameraDeviceFallback";
}

function CameraSimplePicker({ cameraSelection, camera, settingKey }: CameraPickerProps) {
    const options = [
        { label: "None", value: "", default: false },
        ...cameraSelection.map((device: any) => ({
            label: device.name,
            value: device.id,
            default: false,
        }))
    ];

    return (
        <SearchableSelect
            placeholder="Select a camera device"
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === (camera || ""))}
            onChange={v => settings.store[settingKey] = v || ""}
            closeOnSelect
        />
    );
}

function CameraSetting({ settingKey }: { settingKey: "cameraDevice" | "cameraDeviceFallback" }) {
    const camera = settings.use([settingKey])[settingKey];
    const [cameraSelection, setCameraSelection] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        function fetchCameras() {
            setLoading(true);
            try {
                const videoDevices = Object.values(configModule.getVideoDevices() || {});
                if (active) {
                    setCameraSelection(videoDevices);
                    setLoading(false);
                }
            } catch (e) {
                logger.warn("Failed to get video devices:", e);
                if (active) {
                    setCameraSelection([]);
                    setLoading(false);
                }
            }
        }
        fetchCameras();
        return () => { active = false; };
    }, []);

    if (loading) return <Paragraph>Loading camera devices...</Paragraph>;
    if (!cameraSelection.length) return <Paragraph>No cameras found.</Paragraph>;

    return <CameraSimplePicker cameraSelection={cameraSelection} camera={camera} settingKey={settingKey} />;
}

export function CameraSettingSection() {
    return (
        <section>
            <Heading>Primary camera device</Heading>
            <Paragraph>Primary camera to use when joining a voice channel</Paragraph>
            <CameraSetting settingKey="cameraDevice" />
        </section>
    );
}

export function CameraFallbackSettingSection() {
    return (
        <section>
            <Heading>Fallback camera device</Heading>
            <Paragraph>Used if the primary camera is not available</Paragraph>
            <CameraSetting settingKey="cameraDeviceFallback" />
        </section>
    );
}
