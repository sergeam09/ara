const WORKER_URL = 'https://ara.sergeam09.workers.dev';
export class ConfigLoader {
    async loadConfig(projectSlug) {
        // Try KV first (instantaneous, no cache)
        try {
            const response = await fetch(`${WORKER_URL}?config=${projectSlug}`);
            if (response.ok) {
                const data = await response.json();
                if (!data.error) {
                    return data;
                }
            }
        }
        catch (e) {
            console.warn('Failed to load config from KV');
        }
        // Fallback to GitHub Pages (may have cache)
        try {
            const base = this.getBase();
            const response = await fetch(`${base}/proyectos/${projectSlug}/config.json?t=${Date.now()}`);
            if (response.ok) {
                return await response.json();
            }
        }
        catch (e) {
            console.warn('Failed to load config from GitHub Pages');
        }
        return null;
    }
    async checkFileExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        }
        catch {
            return false;
        }
    }
    getBase() {
        const { protocol, host, pathname } = location;
        return `${protocol}//${host}${pathname.replace('viewer.html', '').replace(/\/$/, '')}`;
    }
    getProjectPath(projectSlug) {
        return `${this.getBase()}/proyectos/${projectSlug}`;
    }
}
