(() => {
    const storageKey = 'ultrapc-theme';
    let preference = 'system';

    try {
        const storedPreference = window.localStorage.getItem(storageKey);
        if (storedPreference === 'light' || storedPreference === 'dark' || storedPreference === 'system') {
            preference = storedPreference;
        }
    } catch {
        // Storage may be unavailable in privacy-restricted browsing contexts.
    }

    const isDark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
})();
