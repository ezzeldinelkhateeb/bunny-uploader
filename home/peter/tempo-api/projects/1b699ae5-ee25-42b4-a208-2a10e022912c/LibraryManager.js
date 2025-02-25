import { formatBytes, formatBitrateTable } from '../utils/formatters.js';

class LibraryManager {
    constructor(apiService, elements) {
        this.api = apiService;
        this.elements = elements;
        this._libraries = new Map();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.elements.librarySelect.addEventListener('change', () => this.handleLibraryChange());
    }

    async handleLibraryChange() {
        const libraryId = this.elements.librarySelect.value;
        if (!libraryId) {
            this.elements.collectionSelect.innerHTML = '<option value="">Choose a collection...</option>';
            this.elements.collectionSelect.disabled = true;
            return;
        }

        try {
            const library = this._libraries.get(libraryId);
            if (library) {
                this.api.setLibraryApiKey(library.apiKey);
            }

            const collections = await this.api.getCollections(libraryId);
            console.log('Fetched collections:', collections); // Debug log

            this.updateCollectionsDropdown(collections);
        } catch (error) {
            console.error('Error loading collections:', error);
            this.elements.collectionSelect.innerHTML = '<option value="">Error loading collections</option>';
            this.elements.collectionSelect.disabled = true;
        }
    }

    updateCollectionsDropdown(collections) {
        if (!Array.isArray(collections)) {
            collections = [];
        }

        const options = collections.map(col => 
            `<option value="${col.id}">${col.name || 'Unnamed Collection'}</option>`
        ).join('');

        this.elements.collectionSelect.innerHTML = `
            <option value="">Choose a collection...</option>
            ${options}
        `;
        this.elements.collectionSelect.disabled = false;
    }

    async loadLibraries() {
        try {
            const libraries = await this.api.getLibraries();
            this._libraries.clear();
            
            libraries.forEach(lib => {
                this._libraries.set(lib.id, lib);
            });

            this.updateLibraryDropdown(libraries);
        } catch (error) {
            console.error('Error loading libraries:', error);
            throw error;
        }
    }

    updateLibraryDropdown(libraries) {
        this.elements.librarySelect.innerHTML = `
            <option value="">Choose a library...</option>
            ${libraries.map(lib => 
                `<option value="${lib.id}">${lib.name || 'Unnamed Library'}</option>`
            ).join('')}
        `;
    }

    displayLibraryDetails(library) {
        // ...existing displayLibraryDetails code...
    }

    getLibraryApiKey(libraryId) {
        const library = this._libraries.get(libraryId);
        return library?.apiKey;
    }
}

export default LibraryManager;
