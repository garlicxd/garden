import { App, Widget } from "astal/gtk3"
import style from "./style.scss"
import MprisPlayers from "./widget/Player"

App.start({
    instanceName: "players",
    css: style,
    main: () => {
        new Widget.Window({}, MprisPlayers())
    }
})