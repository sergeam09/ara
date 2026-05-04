const STORAGE_KEY = 'ara-projects';
export class ProjectManager {
    saveProject(project) {
        const projects = this.getAllProjects();
        const existing = projects.findIndex(p => p.nombre === project.nombre);
        const storable = {
            ...project,
            trigger: undefined, // Don't store file
            layers: project.layers.map(l => ({
                ...l,
                file: undefined // Don't store files
            }))
        };
        if (existing >= 0) {
            projects[existing] = storable;
        }
        else {
            projects.unshift(storable);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
    getProject(name) {
        const projects = this.getAllProjects();
        const found = projects.find(p => p.nombre === name);
        return found || null;
    }
    getAllProjects() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        }
        catch (e) {
            console.warn('Failed to load projects from localStorage');
            return [];
        }
    }
    deleteProject(name) {
        const projects = this.getAllProjects();
        const filtered = projects.filter(p => p.nombre !== name);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
    clear() {
        localStorage.removeItem(STORAGE_KEY);
    }
}
