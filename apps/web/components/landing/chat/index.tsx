import type { ComponentType } from "react";
import { GrokScreen } from "./grok";
import { IMessageScreen } from "./imessage";
import { InstagramScreen } from "./instagram";
import type { ChatScreenProps, ChatStyle } from "./model";

export { ContactAvatar } from "./avatar";
export * from "./model";
export { GrokScreen, IMessageScreen, InstagramScreen };

const SCREENS: Record<ChatStyle, ComponentType<ChatScreenProps>> = {
  imessage: IMessageScreen,
  instagram: InstagramScreen,
  grok: GrokScreen,
};

/** One chat screen in the given app's style. Sits inside a `PhoneFrame`. */
export function ChatScreen({ style, ...props }: ChatScreenProps & { style: ChatStyle }) {
  const Screen = SCREENS[style];
  return <Screen {...props} />;
}
