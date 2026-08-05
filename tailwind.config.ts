import { type Config } from "tailwindcss";

export default {
    content: ["./src/**/*.tsx"],
    theme: {
        extend: {
            colors: {
                tm1: "#F99E45",
                tm2: "#DA6302",
                ts1: "#FFDF94",
                ts2: "#FAE979",
            },
        },
    },
    plugins: [],
} satisfies Config;