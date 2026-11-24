module.exports = {
    content: {
        relative: true,
        files: ['./index.html', './main.jsx', './{app,components,features,hooks,lib,services}/**/*.{js,jsx}']
    },
    theme: {
        extend: {
            colors: { pine: '#174e42', ink: '#182e2a', canvas: '#f5f6f3' },
            fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
        }
    },
    plugins: []
};
