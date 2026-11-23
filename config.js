/* =====================================================================
   ✏️  SITE SETTINGS — edit this file to change contact details & links
   Leave a value as "" to hide it everywhere on the site.
   ===================================================================== */
window.MTS_CONFIG = {
  /* Database connection (the publishable key is safe to be public) */
  supabaseUrl: "https://jionzadqkgvktpppfejb.supabase.co",
  supabaseKey: "sb_publishable_nR7qbnBFzJCEOvrs94IVHQ_gxSeBi3t",

  /* Logo file (round PNG with transparent background) */
  logo: "/assets/img/logo.png",

  name:    { en: "Macclesfield Tamil Sangam", ta: "மெக்கல்ஸ்ஃபீல்ட் தமிழ்ச் சங்கம்" },
  address: { en: "Macclesfield, Cheshire, United Kingdom", ta: "மெக்கல்ஸ்ஃபீல்ட், செஷயர், ஐக்கிய இராச்சியம்" },

  phone:     "",   // e.g. "+44 7123 456789"
  email:     "",   // e.g. "info@mtauk.org"
  whatsapp:  "",   // number with country code, no + or spaces, e.g. "447123456789"
  facebook:  "",   // full link to the Facebook page
  twitter:   "",   // full link to the X / Twitter page
  instagram: "",   // full link to the Instagram page
  youtube:   "",   // full link to the YouTube channel

  /* Shown in the footer, e.g. "Temple photos: R. Kumar" — leave "" to hide */
  photoCredit: "",

  /* Front-page slideshow. "image" can be a photo link, or "" for the coloured design. */
  slides: [
    { image: "/assets/img/photos/temple-tower-dusk-hd.jpg", title: { en: "வணக்கம்! Welcome", ta: "வணக்கம்! நல்வரவு" },
      text: { en: "Bringing the Tamil community of Macclesfield together", ta: "மெக்கல்ஸ்ஃபீல்ட் தமிழ்ச் சமூகத்தை ஒன்றிணைக்கிறோம்" } },
    { image: "/assets/img/photos/temple-gateway-hd.jpg", title: { en: "Celebrate our festivals", ta: "நம் பண்டிகைகளைக் கொண்டாடுவோம்" },
      text: { en: "Pongal, Tamil New Year, Deepavali and more — together", ta: "பொங்கல், தமிழ்ப் புத்தாண்டு, தீபாவளி மற்றும் பல — ஒன்றாக" } },
    { image: "/assets/img/photos/temple-gateway-glow-hd.jpg", title: { en: "Language & heritage", ta: "மொழியும் மரபும்" },
      text: { en: "Passing Tamil language, arts and values to the next generation", ta: "தமிழ் மொழி, கலை, பண்பாட்டை அடுத்த தலைமுறைக்குக் கொண்டு சேர்ப்போம்" } },
    { image: "/assets/img/photos/temple-courtyard-hd.jpg", title: { en: "Join the Sangam", ta: "சங்கத்தில் இணையுங்கள்" },
      text: { en: "Everyone is welcome — families, students and friends", ta: "குடும்பங்கள், மாணவர்கள், நண்பர்கள் — அனைவரும் வருக" } }
  ]
};
