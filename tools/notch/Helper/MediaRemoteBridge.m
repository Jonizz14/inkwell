// Runs inside /usr/bin/perl (a platform binary that macOS still lets talk to
// MediaRemote). Streams now-playing state to stdout as JSON lines and reads
// playback commands from stdin. Exits when stdin closes (parent quit).
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <dlfcn.h>
#import <unistd.h>

typedef void (*MRGetInfo)(dispatch_queue_t, void (^)(NSDictionary *));
typedef void (*MRGetBool)(dispatch_queue_t, void (^)(BOOL));
typedef void (*MRGetInt)(dispatch_queue_t, void (^)(int));
typedef void (*MRRegister)(dispatch_queue_t);
typedef Boolean (*MRSendCommand)(int, NSDictionary *);
typedef void (*MRSetElapsed)(double);

static MRGetInfo getInfo;
static MRGetBool getPlaying;
static MRGetInt getPID;
static MRSendCommand sendCommand;
static MRSetElapsed setElapsed;
static dispatch_queue_t queue;
static NSString *lastTrackKey = @"";
static NSUInteger lastArtLength = 0;
static BOOL pending = NO;

static void writeLine(NSDictionary *obj) {
    NSData *json = [NSJSONSerialization dataWithJSONObject:obj options:0 error:nil];
    if (!json) return;
    NSMutableData *line = [json mutableCopy];
    [line appendBytes:"\n" length:1];
    const char *bytes = line.bytes;
    size_t left = line.length;
    while (left > 0) {
        ssize_t n = write(STDOUT_FILENO, bytes, left);
        if (n <= 0) exit(0);
        bytes += n;
        left -= (size_t)n;
    }
}

static void emit(void) {
    pending = NO;
    getInfo(queue, ^(NSDictionary *info) {
        getPID(queue, ^(int pid) {
            getPlaying(queue, ^(BOOL playing) {
                NSMutableDictionary *o = [NSMutableDictionary dictionary];
                o[@"playing"] = @(playing);
                o[@"pid"] = @(pid);
                NSRunningApplication *app = pid > 0 ? [NSRunningApplication runningApplicationWithProcessIdentifier:pid] : nil;
                if (app.bundleIdentifier) o[@"bundle"] = app.bundleIdentifier;

                NSString *title = info[@"kMRMediaRemoteNowPlayingInfoTitle"];
                if (title) o[@"title"] = title;
                NSString *artist = info[@"kMRMediaRemoteNowPlayingInfoArtist"];
                if (artist) o[@"artist"] = artist;
                NSString *album = info[@"kMRMediaRemoteNowPlayingInfoAlbum"];
                if (album) o[@"album"] = album;
                NSNumber *duration = info[@"kMRMediaRemoteNowPlayingInfoDuration"];
                if (duration) o[@"duration"] = duration;
                NSNumber *elapsed = info[@"kMRMediaRemoteNowPlayingInfoElapsedTime"];
                if (elapsed) o[@"elapsed"] = elapsed;
                NSNumber *rate = info[@"kMRMediaRemoteNowPlayingInfoPlaybackRate"];
                if (rate) o[@"rate"] = rate;
                NSDate *ts = info[@"kMRMediaRemoteNowPlayingInfoTimestamp"];
                o[@"ts"] = @((ts ?: [NSDate date]).timeIntervalSince1970);

                // MediaRemote sometimes omits artwork for a moment (e.g. on pause).
                // Only clear it when the track actually changed.
                NSData *art = info[@"kMRMediaRemoteNowPlayingInfoArtworkData"];
                NSString *trackKey = [NSString stringWithFormat:@"%@|%@|%@", title ?: @"", artist ?: @"", album ?: @""];
                BOOL trackChanged = ![trackKey isEqualToString:lastTrackKey];
                if (art.length > 0 && (trackChanged || art.length != lastArtLength)) {
                    o[@"art"] = [art base64EncodedStringWithOptions:0];
                    lastArtLength = art.length;
                } else if (art.length == 0 && trackChanged) {
                    o[@"art"] = @"";
                    lastArtLength = 0;
                }
                lastTrackKey = trackKey;
                writeLine(o);
            });
        });
    });
}

// MediaRemote fires notifications in bursts; coalesce them.
static void scheduleEmit(void) {
    if (pending) return;
    pending = YES;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 60 * NSEC_PER_MSEC), queue, ^{ emit(); });
}

static void handleCommand(NSString *line) {
    NSArray<NSString *> *parts = [line componentsSeparatedByString:@" "];
    NSString *cmd = parts.firstObject;
    if ([cmd isEqualToString:@"toggle"]) sendCommand(2, nil);
    else if ([cmd isEqualToString:@"play"]) sendCommand(0, nil);
    else if ([cmd isEqualToString:@"pause"]) sendCommand(1, nil);
    else if ([cmd isEqualToString:@"next"]) sendCommand(4, nil);
    else if ([cmd isEqualToString:@"prev"]) sendCommand(5, nil);
    else if ([cmd isEqualToString:@"seek"] && parts.count > 1) setElapsed(parts[1].doubleValue);
    else if ([cmd isEqualToString:@"refresh"]) { lastTrackKey = @""; }
    scheduleEmit();
}

__attribute__((visibility("default"))) void islet_run(void) {
    void *mr = dlopen("/System/Library/PrivateFrameworks/MediaRemote.framework/MediaRemote", RTLD_NOW);
    if (!mr) exit(2);
    getInfo = (MRGetInfo)dlsym(mr, "MRMediaRemoteGetNowPlayingInfo");
    getPlaying = (MRGetBool)dlsym(mr, "MRMediaRemoteGetNowPlayingApplicationIsPlaying");
    getPID = (MRGetInt)dlsym(mr, "MRMediaRemoteGetNowPlayingApplicationPID");
    sendCommand = (MRSendCommand)dlsym(mr, "MRMediaRemoteSendCommand");
    setElapsed = (MRSetElapsed)dlsym(mr, "MRMediaRemoteSetElapsedTime");
    MRRegister reg = (MRRegister)dlsym(mr, "MRMediaRemoteRegisterForNowPlayingNotifications");
    if (!getInfo || !getPlaying || !getPID || !sendCommand || !setElapsed || !reg) exit(3);

    queue = dispatch_queue_create("islet.mediaremote", DISPATCH_QUEUE_SERIAL);
    reg(queue);
    for (NSString *name in @[@"kMRMediaRemoteNowPlayingInfoDidChangeNotification",
                             @"kMRMediaRemoteNowPlayingApplicationIsPlayingDidChangeNotification",
                             @"kMRMediaRemoteNowPlayingApplicationDidChangeNotification",
                             @"kMRMediaRemoteNowPlayingApplicationClientStateDidChange"]) {
        [[NSNotificationCenter defaultCenter] addObserverForName:name object:nil queue:nil usingBlock:^(NSNotification *n) {
            dispatch_async(queue, ^{ scheduleEmit(); });
        }];
    }

    __block NSMutableData *buffer = [NSMutableData data];
    dispatch_source_t input = dispatch_source_create(DISPATCH_SOURCE_TYPE_READ, STDIN_FILENO, 0, queue);
    dispatch_source_set_event_handler(input, ^{
        char chunk[512];
        ssize_t n = read(STDIN_FILENO, chunk, sizeof chunk);
        if (n <= 0) exit(0);
        [buffer appendBytes:chunk length:(NSUInteger)n];
        while (YES) {
            NSRange nl = [buffer rangeOfData:[NSData dataWithBytes:"\n" length:1] options:0 range:NSMakeRange(0, buffer.length)];
            if (nl.location == NSNotFound) break;
            NSString *line = [[NSString alloc] initWithData:[buffer subdataWithRange:NSMakeRange(0, nl.location)] encoding:NSUTF8StringEncoding];
            [buffer replaceBytesInRange:NSMakeRange(0, nl.location + 1) withBytes:NULL length:0];
            if (line.length) handleCommand(line);
        }
    });
    dispatch_resume(input);

    dispatch_async(queue, ^{ scheduleEmit(); });
    CFRunLoopRun();
}
