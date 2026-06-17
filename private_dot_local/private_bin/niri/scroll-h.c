/*
 * Tiny uinput-based horizontal scroll emitter.
 * Usage: scroll-h <direction>
 *   direction: "left" or "right"
 *
 * Creates a temporary uinput device, emits a single REL_HWHEEL event,
 * then destroys the device.  Works on Wayland (including niri).
 */
#include <errno.h>
#include <fcntl.h>
#include <linux/uinput.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static int setup_uinput(void) {
    int fd = open("/dev/uinput", O_WRONLY | O_NONBLOCK);
    if (fd < 0) { perror("open /dev/uinput"); return -1; }

    ioctl(fd, UI_SET_EVBIT, EV_KEY);
    ioctl(fd, UI_SET_EVBIT, EV_REL);
    ioctl(fd, UI_SET_EVBIT, EV_SYN);
    ioctl(fd, UI_SET_RELBIT, REL_HWHEEL);
    ioctl(fd, UI_SET_RELBIT, REL_WHEEL);
    ioctl(fd, UI_SET_RELBIT, REL_X);
    ioctl(fd, UI_SET_RELBIT, REL_Y);
    ioctl(fd, UI_SET_KEYBIT, BTN_LEFT);
    ioctl(fd, UI_SET_KEYBIT, BTN_RIGHT);
    ioctl(fd, UI_SET_KEYBIT, BTN_MIDDLE);

    struct uinput_setup usetup = {0};
    strncpy(usetup.name, "scroll-h virtual device", UINPUT_MAX_NAME_SIZE - 1);
    usetup.id.bustype = BUS_USB;
    usetup.id.vendor  = 0x1;
    usetup.id.product = 0x1;
    usetup.id.version = 1;

    if (ioctl(fd, UI_DEV_SETUP, &usetup) < 0) { perror("UI_DEV_SETUP"); close(fd); return -1; }
    if (ioctl(fd, UI_DEV_CREATE) < 0)         { perror("UI_DEV_CREATE"); close(fd); return -1; }

    /* wait for the device to register */
    usleep(100000);
    return fd;
}

static void emit(int fd, int value) {
    struct input_event ev = {0};
    gettimeofday(&ev.time, NULL);
    ev.type  = EV_REL;
    ev.code  = REL_HWHEEL;
    ev.value = value;
    write(fd, &ev, sizeof(ev));

    /* sync */
    ev.type  = EV_SYN;
    ev.code  = SYN_REPORT;
    ev.value = 0;
    write(fd, &ev, sizeof(ev));
}

int main(int argc, char **argv) {
    if (argc != 2) {
        fprintf(stderr, "Usage: scroll-h <left|right>\n");
        return 1;
    }

    int value;
    if (strcmp(argv[1], "left") == 0)
        value = -1;   /* negative HWHEEL = scroll left */
    else if (strcmp(argv[1], "right") == 0)
        value = 1;    /* positive HWHEEL = scroll right */
    else {
        fprintf(stderr, "Usage: scroll-h <left|right>\n");
        return 1;
    }

    int fd = setup_uinput();
    if (fd < 0) return 1;

    /* Emit a burst of 3 scroll ticks for a noticeable scroll */
    for (int i = 0; i < 3; i++) {
        emit(fd, value);
        usleep(20000);
    }

    sleep(1); /* give niri time to process */

    ioctl(fd, UI_DEV_DESTROY);
    close(fd);
    return 0;
}
