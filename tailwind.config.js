/** Tailwind build config. Build with: npm run build:css  (outputs assets/css/tailwind.css)
 *  Merges the inline configs the pages used with the Play CDN; oc* colors are the Owens Corning page theme. */
module.exports = {
  content: ['./*.html', './brands/**/*.html', './assets/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        obsidian: '#0F0F10', charcoal: '#2F3033', cleanwhite: '#FFFFFF',
        softwhite: '#F5F3EE', gold: '#C8923A', goldbright: '#DBA44C',
        ocpink: '#E2007A', ocpinkdark: '#B8005F', ocpinktint: '#FCEFF6',
        ocink: '#1A1A1A', ocgray: '#666666', ocline: '#E6E6E6',
      },
      fontFamily: { display: ['Bebas Neue', 'sans-serif'], body: ['Inter', 'sans-serif'] },
    },
  },
};
