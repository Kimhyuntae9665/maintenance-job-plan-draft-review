"""Dedicated serialized v2 adapter preserves HTTP rejection details around v1 lock transport.
The temporary opener observer runs only within this separate single-threaded process.
V1 files/attempts are never changed. No fallback/retry or generated execution.
"""
import urllib.request,urllib.error
import model_client as transport
def call(payload,record):
    original=urllib.request.urlopen
    def observed(*args,**kwargs):
        try:return original(*args,**kwargs)
        except urllib.error.HTTPError as error:
            body=error.read(1048577)
            record['transport_failure']={'kind':'http_error','status':error.code,'body_text':body[:1048576].decode('utf-8',errors='replace'),'body_truncated':len(body)>1048576}
            error.close();raise
    urllib.request.urlopen=observed
    try:return transport.call(payload,record)
    finally:urllib.request.urlopen=original
