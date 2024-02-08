export const lang2coralDomain = {
    "en": "us",
    "ru": "ru",
    "uk": "ua",
    "it": "it"
}

export function reportTypePrefix(monthUTC) {
    let now = new Date();
    let period = new Date(Date.parse(monthUTC));
    
    if (now.getMonth() == period.getMonth()) return "C";
    
    now.setMonth(now.getMonth()-1);
    if (now.getMonth() == period.getMonth() 
        && now.getDate() < 7) { // stupid workaround...
        return "P";
    }
    
    return "F";
}

export function coralPeriod(dateUTC) {
    const date = new Date(Date.parse(dateUTC));
    return date.getFullYear().toString() + (date.getMonth()+1).toString().padStart(2, "0");
}