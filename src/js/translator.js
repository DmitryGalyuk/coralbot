// translator.js
class Translator {
    constructor() {
        this.langPack = {};
        this.languages = [];
    }

    static async getInstance() {
        if (!this.instance) {
            this.instance = this.init();
        }
        return this.instance;
    }

    static async init() {
        if (!this.instance) {
            const translator = new Translator();

            // Use user's language as default
            translator.currentLanguage = navigator.language.split('-')[0];

            try {
                const response = await import('./langpacks/languages.js');
                translator.languages = response.languages;

                // Check if user's language exists in available languages
                const userLangExists = translator.languages.some(lang => lang.code === translator.currentLanguage);

                // If user's language doesn't exist, fall back to English
                if (!userLangExists) {
                    console.log(`Language pack for ${translator.currentLanguage} not found, falling back to English.`);
                    translator.currentLanguage = 'en';
                }

                await translator.loadLanguage(translator.currentLanguage);
            } catch (err) {
                console.error(err);
            }

            this.instance = new Proxy(translator, {
                get(target, prop) {
                    if (prop in target) return target[prop];
                    const value = target.langPack[target.currentLanguage][prop];
                    if (typeof value === 'string' && value.includes('{0}')) {
                        return (...args) => target.format(value, ...args);
                    }
                    return value;
                }
            });
        }

        return this.instance;
    }

    async loadLanguage(language) {
        if (this.langPack[language]) return; // if already loaded, return

        // Fetch the language pack and store it
        try {
            const langData = await import(`./langpacks/${language}.js`);
            this.langPack[language] = langData.default;
        } catch (err) {
            console.error(err);
        }
    }

    async use(language) {
        await this.loadLanguage(language);
        this.currentLanguage = language;
    }

    format(template, ...params) {
        let str = template;
        params.forEach((param, index) => {
            str = str.replace(`{${index}}`, param);
        });
        return str;
    }

    get availableLanguages() {
        return this.languages;
    }

    async translatePage() {
        let T = await Translator.getInstance();
        let controls = document.querySelectorAll("[resId]");

        for (let ctrl of controls) {
            ctrl.textContent = T[ctrl.getAttribute("resId")];
        }
    }
}

export function getTranslator() {
    return Translator.getInstance();
}