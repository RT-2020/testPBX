{
    "data": "SIP/2.0 200 OK\r\nVia: SIP/2.0/WS kt5ioqp8egfh.invalid;branch=z9hG4bK3698998;received=192.168.2.182;rport=9182\r\nFrom: \"Web客户端\" <sip:5001@192.168.2.200>;tag=optruc7rnv\r\nTo: <sip:1413@192.168.2.200>;tag=v1c0N25UyX6gN\r\nCall-ID: jiano6tpallp715dm5a2\r\nCSeq: 585 INVITE\r\nContact: <sip:1413@192.168.2.200:5060;transport=udp>\r\nUser-Agent: FreeSWITCH\r\nAllow: INVITE, ACK, BYE, CANCEL, OPTIONS, MESSAGE, INFO, UPDATE, REGISTER, REFER, NOTIFY, PUBLISH, SUBSCRIBE\r\nSupported: path, replaces\r\nAllow-Events: talk, hold, conference, presence, as-feature-event, dialog, line-seize, call-info, sla, include-session-description, presence.winfo, message-summary, refer\r\nContent-Type: application/sdp\r\nContent-Disposition: session\r\nContent-Length: 529\r\nRemote-Party-ID: \"1413\" <sip:1413@192.168.2.200>;party=calling;privacy=off;screen=no\r\n\r\nv=0\r\no=FreeSWITCH 2832266211 2832266212 IN IP4 192.168.2.200\r\ns=FreeSWITCH\r\nc=IN IP4 192.168.2.200\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 19384 UDP/TLS/RTP/SAVPF 111 0 8 110 126\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 useinbandfec=1\r\na=rtpmap:110 telephone-event/48000\r\na=rtpmap:126 telephone-event/8000\r\na=setup:active\r\na=fingerprint:SHA-256 AF:D3:EB:D9:50:83:5D:86:3F:D3:7B:4C:D1:C1:4B:B5:CE:72:1C:C9:2A:64:72:19:50:7E:D6:69:9B:12:E7:C7\r\na=rtcp-mux\r\na=mid:0\r\na=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\na=rtcp-fb:* trr-int 1000\r\n",
    "headers": {
        "Via": [
            {
                "raw": "SIP/2.0/WS kt5ioqp8egfh.invalid;branch=z9hG4bK3698998;received=192.168.2.182;rport=9182",
                "parsed": {
                    "protocol": "SIP",
                    "transport": "WS",
                    "host_type": "IPv4",
                    "host": "kt5ioqp8egfh.invalid",
                    "branch": "z9hG4bK3698998",
                    "received": "192.168.2.182",
                    "rport": 9182
                }
            }
        ],
        "From": [
            {
                "raw": "\"Web客户端\" <sip:5001@192.168.2.200>;tag=optruc7rnv",
                "parsed": {
                    "_uri": {
                        "_parameters": {},
                        "_headers": {},
                        "_scheme": "sip",
                        "_user": "5001",
                        "_host": "192.168.2.200"
                    },
                    "_parameters": {
                        "tag": "optruc7rnv"
                    },
                    "_display_name": "Web客户端"
                }
            }
        ],
        "To": [
            {
                "raw": "<sip:1413@192.168.2.200>;tag=v1c0N25UyX6gN",
                "parsed": {
                    "_uri": {
                        "_parameters": {},
                        "_headers": {},
                        "_scheme": "sip",
                        "_user": "1413",
                        "_host": "192.168.2.200"
                    },
                    "_parameters": {
                        "tag": "v1c0N25UyX6gN"
                    }
                }
            }
        ],
        "Call-ID": [
            {
                "raw": "jiano6tpallp715dm5a2",
                "parsed": "jiano6tpallp715dm5a2"
            }
        ],
        "CSeq": [
            {
                "raw": "585 INVITE",
                "parsed": {
                    "value": 585,
                    "method": "INVITE"
                }
            }
        ],
        "Contact": [
            {
                "raw": "<sip:1413@192.168.2.200:5060;transport=udp>",
                "parsed": {
                    "_uri": {
                        "_parameters": {
                            "transport": "udp"
                        },
                        "_headers": {},
                        "_scheme": "sip",
                        "_user": "1413",
                        "_host": "192.168.2.200",
                        "_port": 5060
                    },
                    "_parameters": {}
                }
            }
        ],
        "User-Agent": [
            {
                "raw": "FreeSWITCH"
            }
        ],
        "Allow": [
            {
                "raw": "INVITE, ACK, BYE, CANCEL, OPTIONS, MESSAGE, INFO, UPDATE, REGISTER, REFER, NOTIFY, PUBLISH, SUBSCRIBE"
            }
        ],
        "Supported": [
            {
                "raw": "path, replaces"
            }
        ],
        "Allow-Events": [
            {
                "raw": "talk, hold, conference, presence, as-feature-event, dialog, line-seize, call-info, sla, include-session-description, presence.winfo, message-summary, refer"
            }
        ],
        "Content-Type": [
            {
                "raw": "application/sdp",
                "parsed": "application/sdp"
            }
        ],
        "Content-Disposition": [
            {
                "raw": "session"
            }
        ],
        "Content-Length": [
            {
                "raw": "529",
                "parsed": 529
            }
        ],
        "Remote-Party-Id": [
            {
                "raw": "\"1413\" <sip:1413@192.168.2.200>;party=calling;privacy=off;screen=no"
            }
        ]
    },
    "method": "INVITE",
    "via": {
        "protocol": "SIP",
        "transport": "WS",
        "host_type": "IPv4",
        "host": "kt5ioqp8egfh.invalid",
        "branch": "z9hG4bK3698998",
        "received": "192.168.2.182",
        "rport": 9182
    },
    "via_branch": "z9hG4bK3698998",
    "call_id": "jiano6tpallp715dm5a2",
    "cseq": 585,
    "from": {
        "_uri": {
            "_parameters": {},
            "_headers": {},
            "_scheme": "sip",
            "_user": "5001",
            "_host": "192.168.2.200"
        },
        "_parameters": {
            "tag": "optruc7rnv"
        },
        "_display_name": "Web客户端"
    },
    "from_tag": "optruc7rnv",
    "to": {
        "_uri": {
            "_parameters": {},
            "_headers": {},
            "_scheme": "sip",
            "_user": "1413",
            "_host": "192.168.2.200"
        },
        "_parameters": {
            "tag": "v1c0N25UyX6gN"
        }
    },
    "to_tag": "v1c0N25UyX6gN",
    "body": "v=0\r\no=FreeSWITCH 2832266211 2832266212 IN IP4 192.168.2.200\r\ns=FreeSWITCH\r\nc=IN IP4 192.168.2.200\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=audio 19384 UDP/TLS/RTP/SAVPF 111 0 8 110 126\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 useinbandfec=1\r\na=rtpmap:110 telephone-event/48000\r\na=rtpmap:126 telephone-event/8000\r\na=setup:active\r\na=fingerprint:SHA-256 AF:D3:EB:D9:50:83:5D:86:3F:D3:7B:4C:D1:C1:4B:B5:CE:72:1C:C9:2A:64:72:19:50:7E:D6:69:9B:12:E7:C7\r\na=rtcp-mux\r\na=mid:0\r\na=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r\na=rtcp-fb:* trr-int 1000\r\n",
    "sdp": null,
    "status_code": 200,
    "reason_phrase": "OK"
}