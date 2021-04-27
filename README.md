# Nice service worker

This is sw that you should edit for your needs.  
If you want to update SW, just change it version

## Logic
1. First it adds to cache items from staticCacheResources property while initialization:  
```
staticCacheResources: [
    '/offline.html',
    '/offlineImage.svg',
],
```  
2. Then SW deletes an old cache on activating  
3. On fetch, it tests request for some criteria (pattern, get method and origin). You can change pattern in properties.   
4. Аfter that ше determines the content type of requested resource  
5. If content type is text/html, SW tries to download it from net, in case of a failure SW gets it from cache, if resource wasn't cached, SW makes offline response  
6. If content type is note text/html, first it takes from cache, next steps is the same.