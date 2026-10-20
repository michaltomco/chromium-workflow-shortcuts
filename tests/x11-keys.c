/* Keyboard helper for split-browser.cjs. Use only with a disposable Xvfb display:
 * cc tests/x11-keys.c -o /tmp/workflow-xkeys -lX11 -lXtst
 * SPLIT_TEST_DISPLAY=:98 SPLIT_TEST_KEY_HELPER=/tmp/workflow-xkeys node tests/split-browser.cjs
 */
#include <X11/Xlib.h>
#include <X11/extensions/XTest.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
    const char *name = getenv("SPLIT_TEST_DISPLAY");
    if (!name) {
        fputs("Set SPLIT_TEST_DISPLAY to a disposable virtual display.\n", stderr);
        return 1;
    }
    Display *display = XOpenDisplay(name);
    if (!display) return 1;
    Window root, parent, *children;
    unsigned count;
    XQueryTree(display, DefaultRootWindow(display), &root, &parent, &children, &count);
    for (int i = (int)count - 1; i >= 0; i--) {
        XWindowAttributes attributes;
        XGetWindowAttributes(display, children[i], &attributes);
        if (attributes.map_state == IsViewable && attributes.width > 300 && attributes.height > 200) {
            XSetInputFocus(display, children[i], RevertToParent, CurrentTime);
            break;
        }
    }
    XFree(children);
    for (int i = 1; i < argc; i++)
        XTestFakeKeyEvent(display, XKeysymToKeycode(display, XStringToKeysym(argv[i])), True, 50);
    for (int i = argc - 1; i > 0; i--)
        XTestFakeKeyEvent(display, XKeysymToKeycode(display, XStringToKeysym(argv[i])), False, 50);
    XSync(display, False);
    XCloseDisplay(display);
    return 0;
}
